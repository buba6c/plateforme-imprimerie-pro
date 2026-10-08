// Ce qu'il se passe pour une commande, en mots de tous les jours : une étiquette courte
// et la prochaine étape. Utilisé par les cartes de commande et la vue d'ensemble.
import { formatDate, MACHINE_LABELS, type Statut } from '@evocom/shared';
import type { DossierResume } from '../../lib/types';

type D = Pick<DossierResume, 'machine' | 'nb_fichiers' | 'commentaire_revision' | 'livraison_prevue_at' | 'livreur_nom' | 'livre_at' | 'termine_at' | 'mode_remise'>;

export const EN_CLAIR: Record<Statut, { etiquette: string; suite: (d: D) => string }> = {
  en_cours: { etiquette: 'À préparer', suite: (d) => (d.nb_fichiers ? 'Fichiers reçus : à valider pour l’impression' : 'En attente des fichiers du client') },
  a_revoir: { etiquette: 'À corriger', suite: (d) => (d.commentaire_revision ? `À corriger : ${d.commentaire_revision}` : 'Renvoyé au préparateur pour correction') },
  pret_impression: { etiquette: 'À imprimer', suite: (d) => `Attend l’imprimeur ${MACHINE_LABELS[d.machine]}` },
  en_impression: { etiquette: 'Sur la machine', suite: (d) => `En cours d’impression sur la ${MACHINE_LABELS[d.machine]}` },
  pret_livraison: {
    etiquette: 'Prêt',
    suite: (d) => (d.mode_remise === 'retrait' ? 'Imprimé : le client peut venir le chercher' : 'Imprimé : à confier au livreur'),
  },
  en_livraison: {
    etiquette: 'En route',
    suite: (d) => (d.livraison_prevue_at ? `Livraison prévue le ${formatDate(d.livraison_prevue_at)}` : `Chez le livreur${d.livreur_nom ? ` (${d.livreur_nom})` : ''}`),
  },
  livre: { etiquette: 'Livré', suite: (d) => (d.livre_at ? `Remis au client le ${formatDate(d.livre_at)}` : 'Remis au client') },
  termine: { etiquette: 'Terminé', suite: () => 'Commande close' },
};
