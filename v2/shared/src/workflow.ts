// Circuit d'un dossier : la seule table de transitions de l'application.
// Le serveur s'en sert pour autoriser une action ; l'interface pour afficher les boutons.

import { machineOfRole, type Machine, type Role, type Statut } from './domain';

export type ActionId =
  | 'valider'
  | 'renvoyer_preparation'
  | 'demarrer'
  | 'remettre_en_attente'
  | 'marquer_imprime'
  | 'demander_revision'
  | 'programmer_livraison'
  | 'retirer_tournee'
  | 'confirmer_livraison'
  | 'remettre_client'
  | 'cloturer'
  | 'rouvrir'
  | 'reimprimer';

export interface ActionDef {
  id: ActionId;
  label: string;
  /** Phrase affichée dans l'historique, au passé. */
  journal: string;
  from: readonly Statut[];
  to: Statut;
  roles: readonly Role[];
  /** Le préparateur doit être le propriétaire du dossier (l'admin passe toujours). */
  ownerOnly?: boolean;
  /** L'imprimeur doit être celui de la machine du dossier (l'admin passe toujours). */
  sameMachine?: boolean;
  /** Au moins un fichier attaché. */
  requiresFiles?: boolean;
  /** Commentaire obligatoire (révision, réouverture). */
  requiresComment?: boolean;
  /** Formulaire complémentaire à remplir dans l'interface. */
  form?: 'livraison' | 'confirmation_livraison';
  /** Action réservée aux dossiers livrés par le livreur, ou à ceux que le client vient chercher sur place. */
  remise?: 'livraison' | 'retrait';
  tone: 'primary' | 'secondary' | 'danger';
}

const IMPRIMEURS: readonly Role[] = ['imprimeur_roland', 'imprimeur_xerox'];

export const ACTIONS: readonly ActionDef[] = [
  {
    id: 'valider',
    label: 'Valider le dossier',
    journal: 'Dossier validé, envoyé à l\'impression',
    from: ['en_cours', 'a_revoir'],
    to: 'pret_impression',
    roles: ['preparateur', 'admin'],
    ownerOnly: true,
    requiresFiles: true,
    tone: 'primary',
  },
  {
    id: 'renvoyer_preparation',
    label: 'Renvoyer en préparation',
    journal: 'Dossier renvoyé en préparation',
    from: ['pret_impression'],
    to: 'en_cours',
    roles: ['preparateur', 'admin'],
    ownerOnly: true,
    tone: 'secondary',
  },
  {
    id: 'demarrer',
    label: "Démarrer l'impression",
    journal: 'Impression démarrée',
    from: ['pret_impression'],
    to: 'en_impression',
    roles: [...IMPRIMEURS, 'admin'],
    sameMachine: true,
    tone: 'primary',
  },
  {
    id: 'remettre_en_attente',
    label: 'Remettre en attente',
    journal: 'Impression remise en attente',
    from: ['en_impression'],
    to: 'pret_impression',
    roles: [...IMPRIMEURS, 'admin'],
    sameMachine: true,
    tone: 'secondary',
  },
  {
    id: 'marquer_imprime',
    label: 'Marquer comme imprimé',
    journal: 'Impression terminée, prêt à livrer',
    from: ['en_impression'],
    to: 'pret_livraison',
    roles: [...IMPRIMEURS, 'admin'],
    sameMachine: true,
    tone: 'primary',
  },
  {
    id: 'demander_revision',
    label: 'Demander une révision',
    journal: 'Révision demandée',
    from: ['pret_impression', 'en_impression'],
    to: 'a_revoir',
    roles: [...IMPRIMEURS, 'admin'],
    sameMachine: true,
    requiresComment: true,
    tone: 'secondary',
  },
  {
    id: 'programmer_livraison',
    label: 'Programmer la livraison',
    journal: 'Livraison programmée',
    from: ['pret_livraison'],
    to: 'en_livraison',
    roles: ['livreur', 'admin'],
    form: 'livraison',
    remise: 'livraison',
    tone: 'primary',
  },
  {
    id: 'retirer_tournee',
    label: 'Retirer de la tournée',
    journal: 'Livraison retirée de la tournée',
    from: ['en_livraison'],
    to: 'pret_livraison',
    roles: ['livreur', 'admin'],
    remise: 'livraison',
    tone: 'secondary',
  },
  {
    id: 'confirmer_livraison',
    label: 'Confirmer la livraison',
    journal: 'Dossier livré',
    from: ['pret_livraison', 'en_livraison'],
    to: 'livre',
    roles: ['livreur', 'admin'],
    form: 'confirmation_livraison',
    remise: 'livraison',
    tone: 'primary',
  },
  {
    id: 'remettre_client',
    label: 'Remis au client',
    journal: 'Retiré par le client sur place',
    from: ['pret_livraison'],
    to: 'livre',
    roles: ['preparateur', 'admin'],
    remise: 'retrait',
    form: 'confirmation_livraison',
    tone: 'primary',
  },
  {
    id: 'cloturer',
    label: 'Clôturer le dossier',
    journal: 'Dossier clôturé',
    from: ['livre'],
    to: 'termine',
    roles: ['admin'],
    tone: 'primary',
  },
  {
    id: 'rouvrir',
    label: 'Rouvrir le dossier',
    journal: 'Dossier rouvert',
    from: ['termine'],
    to: 'livre',
    roles: ['admin'],
    requiresComment: true,
    tone: 'secondary',
  },
  {
    id: 'reimprimer',
    label: 'Remettre en impression',
    journal: 'Dossier remis en impression',
    from: ['pret_livraison', 'en_livraison', 'livre'],
    to: 'pret_impression',
    roles: ['admin'],
    requiresComment: true,
    tone: 'secondary',
  },
];

/** Accès sûr par identifiant (pas d'héritage d'Object.prototype : « constructor » n'est pas une action). */
export function actionParId(id: string): ActionDef | undefined {
  return Object.hasOwn(ACTIONS_BY_ID, id) ? ACTIONS_BY_ID[id as ActionId] : undefined;
}

export const ACTIONS_BY_ID: Record<ActionId, ActionDef> = Object.fromEntries(ACTIONS.map((a) => [a.id, a])) as Record<
  ActionId,
  ActionDef
>;

export interface WorkflowUser {
  id: number;
  role: Role;
}

export interface WorkflowDossier {
  statut: Statut;
  machine: Machine;
  preparateur_id: number | null;
  nb_fichiers: number;
  /** Livreur désigné (une tournée programmée appartient à son livreur). */
  livreur_id?: number | null;
  /** livraison (par défaut) ou retrait sur place par le client. */
  mode_remise?: 'livraison' | 'retrait' | null;
}

export type Refus =
  | { ok: true }
  | { ok: false; code: 'role' | 'statut' | 'proprietaire' | 'machine' | 'fichiers' | 'commentaire' | 'remise' | 'livreur'; message: string };

/** Vérifie qu'une action est permise. Le message est destiné à l'utilisateur. */
export function verifierAction(
  action: ActionDef,
  user: WorkflowUser,
  dossier: WorkflowDossier,
  opts: { commentaire?: string | null } = {},
): Refus {
  if (!action.roles.includes(user.role)) {
    return { ok: false, code: 'role', message: "Votre rôle ne permet pas cette action." };
  }
  if (!action.from.includes(dossier.statut)) {
    return { ok: false, code: 'statut', message: "Cette action n'est pas possible dans l'état actuel du dossier." };
  }
  if (action.remise && (dossier.mode_remise ?? 'livraison') !== action.remise) {
    return {
      ok: false,
      code: 'remise',
      message: action.remise === 'retrait' ? 'Ce dossier est à livrer : c’est le livreur qui le remet au client.' : 'Ce dossier est à retirer sur place par le client : il ne passe pas par le livreur.',
    };
  }
  if (user.role === 'livreur' && dossier.statut === 'en_livraison' && dossier.livreur_id && dossier.livreur_id !== user.id) {
    return { ok: false, code: 'livreur', message: 'Cette livraison est dans la tournée d’un autre livreur.' };
  }
  if (user.role !== 'admin') {
    if (action.ownerOnly && user.role === 'preparateur' && dossier.preparateur_id !== user.id) {
      return { ok: false, code: 'proprietaire', message: 'Seul le préparateur du dossier ou un administrateur peut faire cette action.' };
    }
    if (action.sameMachine) {
      const m = machineOfRole(user.role);
      if (m !== dossier.machine) {
        return { ok: false, code: 'machine', message: "Ce dossier n'est pas destiné à votre machine." };
      }
    }
  }
  if (action.requiresFiles && dossier.nb_fichiers < 1) {
    return { ok: false, code: 'fichiers', message: 'Ajoutez au moins un fichier avant de valider le dossier.' };
  }
  if (action.requiresComment && !(opts.commentaire && opts.commentaire.trim().length >= 3)) {
    return { ok: false, code: 'commentaire', message: 'Un commentaire est obligatoire pour cette action.' };
  }
  return { ok: true };
}

/** Actions que l'utilisateur peut proposer sur ce dossier (sans tenir compte du commentaire, saisi ensuite). */
export function actionsDisponibles(user: WorkflowUser, dossier: WorkflowDossier): ActionDef[] {
  return ACTIONS.filter((a) => {
    const r = verifierAction(a, user, dossier, { commentaire: 'xxx' });
    // On garde « valider » visible même sans fichier : le bouton explique ce qui manque.
    return r.ok || (!r.ok && r.code === 'fichiers');
  });
}
