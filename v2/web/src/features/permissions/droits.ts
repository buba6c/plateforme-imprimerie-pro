// Droits présentés par l'écran « Rôles et droits », dérivés du code partagé avec le serveur :
// le circuit (ACTIONS + verifierAction) et la navigation de chaque rôle. Rien n'est recopié
// pour le circuit : une modification de shared/src/workflow.ts se reflète ici d'elle-même.

import { ACTIONS, MACHINES, machineOfRole, ROLES, verifierAction, type ActionDef, type Role } from '@evocom/shared';
import { navigationPour } from '../../layout/nav';

/** Oui ; seulement sur ses propres dossiers ; seulement sur les dossiers de sa machine ; non. */
export type Portee = 'oui' | 'proprietaire' | 'machine' | 'non';

const COMMENTAIRE = 'Motif de test';

/** Réponse de verifierAction pour un rôle, sur chaque statut de départ de l'action. */
export function porteeAction(action: ActionDef, role: Role): Portee {
  const machine = machineOfRole(role) ?? MACHINES[0];
  const autreMachine = MACHINES.find((m) => m !== machine)!;
  const user = { id: 1, role };
  let portee: Portee = 'oui';
  for (const statut of action.from) {
    const sien = { statut, machine, preparateur_id: user.id, nb_fichiers: 1 };
    if (!verifierAction(action, user, sien, { commentaire: COMMENTAIRE }).ok) return 'non';
    const autrui = verifierAction(action, user, { ...sien, preparateur_id: user.id + 1 }, { commentaire: COMMENTAIRE });
    if (!autrui.ok && autrui.code === 'proprietaire') portee = 'proprietaire';
    const ailleurs = verifierAction(action, user, { ...sien, machine: autreMachine }, { commentaire: COMMENTAIRE });
    if (!ailleurs.ok && ailleurs.code === 'machine') portee = 'machine';
  }
  return portee;
}

const FORMULAIRES: Record<NonNullable<ActionDef['form']>, string> = {
  livraison: 'Date de livraison prévue',
  confirmation_livraison: 'Encaissement possible à la remise',
};

/** Conditions imposées par verifierAction (testées avec un administrateur), plus le formulaire demandé. */
export function conditionsAction(action: ActionDef): string[] {
  const admin = { id: 1, role: 'admin' as const };
  const d = { statut: action.from[0]!, machine: MACHINES[0], preparateur_id: 1, nb_fichiers: 1 };
  const out: string[] = [];
  const sansFichier = verifierAction(action, admin, { ...d, nb_fichiers: 0 }, { commentaire: COMMENTAIRE });
  if (!sansFichier.ok && sansFichier.code === 'fichiers') out.push('Au moins un fichier');
  const sansCommentaire = verifierAction(action, admin, d, { commentaire: '' });
  if (!sansCommentaire.ok && sansCommentaire.code === 'commentaire') out.push('Commentaire obligatoire');
  if (action.form) out.push(FORMULAIRES[action.form]);
  return out;
}

export interface LigneCircuit {
  action: ActionDef;
  roles: Record<Role, Portee>;
  conditions: string[];
}

export function tableauCircuit(): LigneCircuit[] {
  return ACTIONS.map((action) => ({
    action,
    roles: Object.fromEntries(ROLES.map((r) => [r, porteeAction(action, r)])) as Record<Role, Portee>,
    conditions: conditionsAction(action),
  }));
}

/**
 * Écrans ouverts à un rôle sans figurer dans son menu (gardes de route de web/src/App.tsx,
 * qui ne sont pas exportées) : l'administrateur peut ouvrir les écrans de l'atelier et du livreur.
 */
const HORS_MENU: Record<string, Role[]> = {
  '/atelier': ['admin'],
  '/livraisons': ['admin'],
  '/livraisons/planning': ['admin'],
  '/livraisons/livrees': ['admin'],
  '/livraisons/historique': ['admin'],
};

export type AccesEcran = { menu: true; libelle: string } | { menu: false; parAdresse: boolean };

export interface LigneEcran {
  chemin: string;
  libelle: string;
  roles: Record<Role, AccesEcran>;
}

/** Une ligne par écran du menu, tous rôles confondus, dans l'ordre des menus. */
export function tableauEcrans(): LigneEcran[] {
  const lignes = new Map<string, LigneEcran>();
  for (const role of ROLES) {
    for (const section of navigationPour(role)) {
      for (const item of section.items) {
        if (!lignes.has(item.to)) {
          lignes.set(item.to, {
            chemin: item.to,
            libelle: item.label,
            roles: Object.fromEntries(ROLES.map((r) => [r, { menu: false, parAdresse: HORS_MENU[item.to]?.includes(r) ?? false }])) as Record<Role, AccesEcran>,
          });
        }
        lignes.get(item.to)!.roles[role] = { menu: true, libelle: item.label };
      }
    }
  }
  return [...lignes.values()];
}
