// Qui est prévenu de quoi. Chaque fonction s'appelle APRÈS la transaction qui a changé le dossier
// (ou avec le client de cette transaction : l'envoi temps réel attend alors le COMMIT, voir
// realtime.apresCommit). Aucune ne lève d'erreur : une notification manquée ne doit jamais
// annuler une action déjà enregistrée.
//
// Les destinataires sont toujours des comptes actifs (realtime.notifier) et l'auteur de l'action
// n'est jamais prévenu de ce qu'il vient de faire.

import { STATUT_LABELS, type ActionId, type Machine, type Role, type Statut } from '@evocom/shared';
import { getPool, type Db } from '../../db/pool';
import { getParametres } from '../../lib/params';
import { notifier, type Destinataires, type NotificationInput } from '../../realtime';
import { evenementWhatsApp, planifierWhatsApp } from '../whatsapp/file';

/** Types émis par ces règles en plus de ceux de lib/params.ts (TYPES_NOTIFICATION). */
export const TYPES_NOTIFICATION_REGLES = ['statut_force', 'report_livraison', 'livraison_programmee', 'livraison_annulee'] as const;

/** Champs du dossier utiles aux règles (une ligne de `dossiers` convient). */
export interface DossierNotif {
  id: number;
  numero: string;
  client_nom: string;
  machine: Machine;
  statut: Statut;
  preparateur_id: number | null;
  imprimeur_id?: number | null;
  livreur_id?: number | null;
  origine_type?: string | null;
  mode_remise?: string | null;
  livraison_prevue_at?: string | Date | null;
}

export interface Auteur {
  id: number;
  role: Role;
}

const ref = (d: DossierNotif) => `${d.numero} · ${d.client_nom}`;
const ids = (...v: (number | null | undefined)[]) => v.filter((x): x is number => typeof x === 'number');
const STATUTS_IMPRESSION: readonly Statut[] = ['pret_impression', 'en_impression'];
const STATUTS_LIVRAISON: readonly Statut[] = ['pret_livraison', 'en_livraison'];
const enRetrait = (d: DossierNotif) => d.mode_remise === 'retrait';

async function envoyer(db: Db, dest: Destinataires, n: NotificationInput): Promise<number[]> {
  try {
    return await notifier(db, dest, n);
  } catch (e) {
    console.error(`Notification « ${n.type} » non envoyée`, e);
    return [];
  }
}

/** Date de livraison lisible dans le fuseau de l'entreprise : « jeudi 9 octobre à 14:00 ». */
export async function dateLivraisonLisible(valeur: string | Date | null | undefined, db?: Db): Promise<string> {
  if (!valeur) return 'date à confirmer';
  const d = typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? new Date(`${valeur}T12:00:00Z`) : new Date(valeur);
  if (Number.isNaN(d.getTime())) return 'date à confirmer';
  let fuseau = 'Africa/Dakar';
  try {
    fuseau = (await getParametres(db)).fuseau;
  } catch {
    /* paramètres illisibles : fuseau par défaut */
  }
  const fmt = (o: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, ...o }).format(d);
    } catch {
      return new Intl.DateTimeFormat('fr-FR', o).format(d);
    }
  };
  const jour = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
  const heure = fmt({ hour: '2-digit', minute: '2-digit' });
  const sansHeure = typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur);
  return sansHeure || heure === '00:00' ? jour : `${jour} à ${heure}`;
}

// ---------------------------------------------------------------------------
// Transitions du circuit

/**
 * Remplace `notifierTransition` de dossiers/service.ts : couvre les cas déjà notifiés
 * (validation, révision, prêt à livrer, livré) et ceux qui manquaient (audit A11) :
 * remise en impression, programmation et retrait par l'administrateur, révision sans
 * préparateur, retrait par le client, dossier corrigé, réimpression.
 */
export async function notifierTransitionDossier(
  auteur: Auteur,
  action: ActionId,
  avant: DossierNotif,
  apres: DossierNotif,
  commentaire: string | null,
  db: Db = getPool(),
): Promise<void> {
  const d = apres;
  switch (action) {
    case 'valider': {
      const titre =
        d.origine_type === 'reimpression'
          ? `Réimpression à faire : ${d.numero}`
          : avant.statut === 'a_revoir'
            ? `Dossier corrigé, à imprimer : ${d.numero}`
            : 'Nouveau dossier à imprimer';
      await envoyer(db, { machine: d.machine, exclure: auteur.id }, { type: 'nouveau_travail', titre, message: ref(d), dossier_id: d.id });
      break;
    }
    case 'demander_revision':
      // Sans préparateur (dossier importé, compte supprimé), les administrateurs sont prévenus seuls.
      await envoyer(
        db,
        { userIds: ids(d.preparateur_id), roles: ['admin'], exclure: auteur.id },
        { type: 'revision', titre: `Révision demandée : ${d.numero}`, message: commentaire ?? d.client_nom, dossier_id: d.id },
      );
      break;
    case 'marquer_imprime':
      if (enRetrait(d)) {
        await envoyer(
          db,
          { userIds: ids(d.preparateur_id), roles: ['admin'], exclure: auteur.id },
          { type: 'pret_livraison', titre: `Prêt, le client vient le chercher : ${d.numero}`, message: d.client_nom, dossier_id: d.id },
        );
      } else {
        await envoyer(
          db,
          { roles: ['livreur'], userIds: ids(d.preparateur_id), exclure: auteur.id },
          { type: 'pret_livraison', titre: 'Dossier prêt à livrer', message: ref(d), dossier_id: d.id },
        );
      }
      break;
    case 'programmer_livraison':
      await notifierLivraisonProgrammee(auteur, d, db);
      break;
    case 'retirer_tournee':
      if (avant.livreur_id && avant.livreur_id !== auteur.id) {
        await envoyer(
          db,
          { userIds: [avant.livreur_id] },
          { type: 'livraison_annulee', titre: `Retiré de votre tournée : ${d.numero}`, message: commentaire ?? d.client_nom, dossier_id: d.id },
        );
      }
      break;
    case 'confirmer_livraison':
    case 'remettre_client':
      await envoyer(
        db,
        { roles: ['admin'], userIds: ids(d.preparateur_id), exclure: auteur.id },
        {
          type: 'livre',
          titre: action === 'remettre_client' ? `Remis au client : ${d.numero}` : `Dossier livré : ${d.numero}`,
          message: d.client_nom,
          dossier_id: d.id,
        },
      );
      break;
    case 'reimprimer':
      await notifierReimpression(auteur, avant, d, commentaire, db);
      break;
    default:
      // demarrer, remettre_en_attente, renvoyer_preparation, cloturer, rouvrir : la mise à jour
      // des listes par le temps réel suffit.
      break;
  }
  // Message WhatsApp au client (module whatsapp) : marquer_imprime (prête, livraison ou retrait),
  // programmer_livraison, confirmer_livraison et remettre_client. Après le COMMIT, jamais bloquant.
  const evenement = evenementWhatsApp(action, d);
  if (evenement) await planifierWhatsApp(evenement, d.id, db);
}

/**
 * Remise en impression d'un dossier (action « reimprimer ») : les imprimeurs de la machine et le
 * préparateur ; le livreur qui l'avait dans sa tournée apprend que la livraison est annulée.
 */
export async function notifierReimpression(auteur: Auteur, avant: DossierNotif, apres: DossierNotif, motif: string | null, db: Db = getPool()): Promise<void> {
  await envoyer(
    db,
    { machine: apres.machine, userIds: ids(apres.preparateur_id), exclure: auteur.id },
    { type: 'nouveau_travail', titre: `Remis en impression : ${apres.numero}`, message: motif ? `${apres.client_nom} · ${motif}` : apres.client_nom, dossier_id: apres.id },
  );
  if (avant.livreur_id && avant.livreur_id !== auteur.id && STATUTS_LIVRAISON.includes(avant.statut)) {
    await envoyer(
      db,
      { userIds: [avant.livreur_id] },
      { type: 'livraison_annulee', titre: `Livraison annulée : ${apres.numero}`, message: 'Le dossier repart en impression.', dossier_id: apres.id },
    );
  }
}

/** Livraison programmée par un administrateur : le livreur désigné, sinon tous les livreurs. */
export async function notifierLivraisonProgrammee(auteur: Auteur, d: DossierNotif, db: Db = getPool()): Promise<void> {
  if (auteur.role === 'livreur') return; // il vient de la programmer lui-même
  const quand = await dateLivraisonLisible(d.livraison_prevue_at, db);
  await envoyer(
    db,
    d.livreur_id ? { userIds: [d.livreur_id], exclure: auteur.id } : { roles: ['livreur'], exclure: auteur.id },
    { type: 'livraison_programmee', titre: `Livraison programmée : ${d.numero}`, message: `${d.client_nom} · ${quand}`, dossier_id: d.id },
  );
}

// ---------------------------------------------------------------------------
// Actions hors circuit

/**
 * Statut forcé par l'administrateur (forcerStatut) : les personnes qui doivent maintenant agir
 * (comme pour la transition équivalente), celles qui perdent le dossier, et un avis
 * « statut forcé » au préparateur et aux autres administrateurs.
 */
export async function notifierStatutForce(auteur: Auteur, avant: DossierNotif, apres: DossierNotif, commentaire: string | null, db: Db = getPool()): Promise<void> {
  const deja = new Set<number>([auteur.id]);
  const noter = (l: number[]) => l.forEach((id) => deja.add(id));
  const vers = apres.statut;
  const exclus = (l: number[]) => l.filter((id) => !deja.has(id));

  if (vers === 'pret_impression' && !STATUTS_IMPRESSION.includes(avant.statut)) {
    noter(
      await envoyer(db, { machine: apres.machine, exclure: auteur.id }, { type: 'nouveau_travail', titre: `Dossier à imprimer : ${apres.numero}`, message: commentaire ?? ref(apres), dossier_id: apres.id }),
    );
  }
  if (vers === 'pret_livraison' && !enRetrait(apres) && !STATUTS_LIVRAISON.includes(avant.statut)) {
    noter(await envoyer(db, { roles: ['livreur'], exclure: auteur.id }, { type: 'pret_livraison', titre: 'Dossier prêt à livrer', message: ref(apres), dossier_id: apres.id }));
  }
  if (vers === 'en_livraison' && avant.statut !== 'en_livraison') {
    const quand = await dateLivraisonLisible(apres.livraison_prevue_at, db);
    noter(
      await envoyer(
        db,
        apres.livreur_id ? { userIds: [apres.livreur_id], exclure: auteur.id } : { roles: ['livreur'], exclure: auteur.id },
        { type: 'livraison_programmee', titre: `Livraison à faire : ${apres.numero}`, message: `${apres.client_nom} · ${quand}`, dossier_id: apres.id },
      ),
    );
  }
  // Le livreur qui avait le dossier dans sa tournée, si le dossier quitte la livraison.
  if (avant.livreur_id && STATUTS_LIVRAISON.includes(avant.statut) && !STATUTS_LIVRAISON.includes(vers) && vers !== 'livre' && vers !== 'termine') {
    if (!deja.has(avant.livreur_id)) {
      noter(
        await envoyer(db, { userIds: [avant.livreur_id] }, { type: 'livraison_annulee', titre: `Livraison annulée : ${apres.numero}`, message: commentaire ?? apres.client_nom, dossier_id: apres.id }),
      );
    }
  }
  // L'imprimeur qui avait le dossier en cours, s'il quitte l'impression.
  const imprimeurPerd = avant.imprimeur_id && STATUTS_IMPRESSION.includes(avant.statut) && !STATUTS_IMPRESSION.includes(vers) ? [avant.imprimeur_id] : [];
  const avis = exclus([...ids(apres.preparateur_id), ...imprimeurPerd]);
  await envoyer(
    db,
    { userIds: avis, roles: ['admin'], exclure: auteur.id },
    {
      type: 'statut_force',
      titre: `Statut forcé : ${apres.numero}`,
      message: `${STATUT_LABELS[avant.statut]} → ${STATUT_LABELS[vers]}${commentaire ? ` · ${commentaire}` : ''}`,
      dossier_id: apres.id,
    },
  );
}

/**
 * Livraison reportée (reporterLivraison). Par le livreur : les administrateurs et le préparateur.
 * Par l'administrateur : le livreur désigné et le préparateur.
 */
export async function notifierReport(
  auteur: Auteur,
  d: DossierNotif,
  ancienneDate: string | Date | null | undefined,
  nouvelleDate: string | Date | null | undefined,
  motif: string | null,
  db: Db = getPool(),
): Promise<void> {
  const quand = await dateLivraisonLisible(nouvelleDate ?? d.livraison_prevue_at, db);
  const avant = ancienneDate ? await dateLivraisonLisible(ancienneDate, db) : null;
  const message = `${d.client_nom} · ${avant ? `${avant} → ` : ''}${quand}${motif ? ` · ${motif}` : ''}`;
  const dest: Destinataires =
    auteur.role === 'livreur'
      ? { roles: ['admin'], userIds: ids(d.preparateur_id), exclure: auteur.id }
      : { userIds: ids(d.livreur_id, d.preparateur_id), exclure: auteur.id };
  await envoyer(db, dest, { type: 'report_livraison', titre: `Livraison reportée : ${d.numero}`, message, dossier_id: d.id });
}

/** Changement de livreur : le nouveau reçoit le dossier, l'ancien apprend qu'il lui est retiré. */
export async function notifierChangementLivreur(
  auteur: Auteur,
  d: DossierNotif,
  ancien: number | null | undefined,
  nouveau: number | null | undefined,
  db: Db = getPool(),
): Promise<void> {
  if ((ancien ?? null) === (nouveau ?? null)) return;
  if (nouveau && nouveau !== auteur.id) {
    const quand = d.livraison_prevue_at ? ` · ${await dateLivraisonLisible(d.livraison_prevue_at, db)}` : '';
    await envoyer(db, { userIds: [nouveau] }, { type: 'affectation', titre: `Livraison qui vous est confiée : ${d.numero}`, message: `${d.client_nom}${quand}`, dossier_id: d.id });
  }
  if (ancien && ancien !== auteur.id) {
    await envoyer(db, { userIds: [ancien] }, { type: 'affectation', titre: `Livraison confiée à un autre livreur : ${d.numero}`, message: d.client_nom, dossier_id: d.id });
  }
}

/** Changement d'imprimeur : même principe que pour le livreur. */
export async function notifierChangementImprimeur(
  auteur: Auteur,
  d: DossierNotif,
  ancien: number | null | undefined,
  nouveau: number | null | undefined,
  db: Db = getPool(),
): Promise<void> {
  if ((ancien ?? null) === (nouveau ?? null)) return;
  if (nouveau && nouveau !== auteur.id) {
    await envoyer(db, { userIds: [nouveau] }, { type: 'affectation', titre: `Dossier qui vous est confié : ${d.numero}`, message: d.client_nom, dossier_id: d.id });
  }
  if (ancien && ancien !== auteur.id) {
    await envoyer(db, { userIds: [ancien] }, { type: 'affectation', titre: `Dossier confié à un autre imprimeur : ${d.numero}`, message: d.client_nom, dossier_id: d.id });
  }
}

/**
 * Remplace la boucle de notification de `affecter` : ne prévient que si la personne change
 * (avant, réaffecter la même personne la notifiait de nouveau) et prévient aussi l'ancienne.
 */
export async function notifierAffectation(auteur: Auteur, avant: DossierNotif, apres: DossierNotif, db: Db = getPool()): Promise<void> {
  await notifierChangementImprimeur(auteur, apres, avant.imprimeur_id, apres.imprimeur_id, db);
  await notifierChangementLivreur(auteur, apres, avant.livreur_id, apres.livreur_id, db);
}

/** Passage en urgent : l'étape où se trouve le dossier (imprimeurs de la machine, ou livreur). */
export async function notifierUrgence(auteur: Auteur, d: DossierNotif, urgent: boolean, db: Db = getPool()): Promise<void> {
  if (!urgent) return;
  if (STATUTS_IMPRESSION.includes(d.statut)) {
    await envoyer(db, { machine: d.machine, exclure: auteur.id }, { type: 'urgent', titre: 'Dossier passé en urgent', message: ref(d), dossier_id: d.id });
  } else if (STATUTS_LIVRAISON.includes(d.statut) && !enRetrait(d)) {
    await envoyer(
      db,
      d.livreur_id ? { userIds: [d.livreur_id], exclure: auteur.id } : { roles: ['livreur'], exclure: auteur.id },
      { type: 'urgent', titre: 'Livraison urgente', message: ref(d), dossier_id: d.id },
    );
  }
}
