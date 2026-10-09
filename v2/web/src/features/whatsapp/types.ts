// Réponses des routes /whatsapp et /parametres/whatsapp (contrat : v2/API.md).

export type EtatWhatsApp = 'deconnecte' | 'qr' | 'connexion' | 'connecte';
export type StatutMessage = 'en_attente' | 'envoye' | 'echec' | 'annule' | 'ignore';
export type EvenementWhatsApp = 'pret_livraison' | 'pret_retrait' | 'en_livraison' | 'livre';

export interface StatutWhatsApp {
  actif: boolean;
  etat: EtatWhatsApp;
  numero: string | null;
  /** Code QR (data URL PNG), seulement en attente de scan. */
  qr: string | null;
  depuis: string | null;
  /** Faux si la bibliothèque WhatsApp manque sur le serveur. */
  disponible: boolean;
  erreur: string | null;
  enregistre: boolean;
  file: { en_attente: number; envoyes_aujourdhui: number; echecs: number };
}

export interface ReglagesWhatsApp {
  actif: boolean;
  modeles: Record<EvenementWhatsApp, string>;
  heures: { debut: string; fin: string };
  limites: { par_heure: number; par_jour: number };
  delai: { min_s: number; max_s: number };
  signature: string;
}

export interface ParametresWhatsApp extends ReglagesWhatsApp {
  defauts: ReglagesWhatsApp;
  variables: string[];
  evenements: Record<EvenementWhatsApp | 'test', string>;
  apercu: Record<EvenementWhatsApp, string>;
}

export interface MessageWhatsApp {
  id: number;
  dossier_id: number | null;
  numero: string | null;
  client_nom: string | null;
  evenement: EvenementWhatsApp | 'test';
  evenement_label: string;
  telephone: string | null;
  texte: string;
  statut: StatutMessage;
  motif: string | null;
  tentatives: number;
  planifie_at: string;
  envoye_at: string | null;
  created_at: string;
}

export interface PageMessages {
  items: MessageWhatsApp[];
  total: number;
  page: number;
  limit: number;
  compteurs: Record<StatutMessage, number>;
}

export interface OptOut {
  telephone: string;
  motif: string | null;
  created_at: string;
}

export interface Entrant {
  id: number;
  telephone: string;
  texte: string;
  recu_at: string;
}

export const STATUT_LABELS: Record<StatutMessage, string> = {
  en_attente: 'En attente',
  envoye: 'Envoyé',
  echec: 'Échec',
  annule: 'Annulé',
  ignore: 'Ignoré',
};

export const ETAT_LABELS: Record<EtatWhatsApp, string> = {
  deconnecte: 'Déconnecté',
  qr: 'Scannez le code QR',
  connexion: 'Connexion en cours',
  connecte: 'Connecté',
};

/** Valeurs d'exemple pour l'aperçu des modèles (les mêmes que le serveur). */
export const VARIABLES_EXEMPLE: Record<string, string> = {
  client: 'Awa Diop',
  numero: 'CMD-2026-0042',
  travail: 'Bâche standard · 300 × 200 cm · 1 ex.',
  montant: '45 000 FCFA',
  adresse: 'Sacré-Cœur 3, Dakar',
  entreprise: 'Evocom Print',
  date: 'jeudi 9 octobre à 14:00',
};

export const VARIABLE_LABELS: Record<string, string> = {
  client: 'nom du client',
  numero: 'numéro de commande',
  travail: 'travail (première ligne des spécifications)',
  montant: 'montant TTC',
  adresse: 'adresse de l’entreprise (Paramètres)',
  entreprise: 'nom de l’entreprise',
  date: 'date de livraison prévue',
};

/** Aperçu d'un modèle avec les valeurs d'exemple, comme le fait le serveur. */
export function apercuModele(modele: string, signature: string): string {
  let t = modele.replace(/\{([a-z_]+)\}/g, (tout, cle: string) => VARIABLES_EXEMPLE[cle] ?? tout);
  t = t.replace(/[ \t]+/g, ' ').trim();
  if (signature.trim()) t += `\n${signature.trim()}`;
  return t;
}
