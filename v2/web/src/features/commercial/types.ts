// Types des réponses de l'API pour les devis, factures et clients (voir v2/API.md).
import type { LignePrix, Machine, ResultatPrix, SituationPaiement, Specs, Statut, StatutDevis, StatutFacture } from '@evocom/shared';

/** Détail de prix stocké avec un devis : résultat du moteur + règle de TVA appliquée. */
export type DetailPrix = ResultatPrix & { tva_applicable?: boolean; tva_taux?: number; prix_saisis_ht?: boolean };

export interface DevisResume {
  id: number;
  numero: string;
  statut: StatutDevis;
  statut_label?: string;
  machine: Machine;
  client_id: number | null;
  client_nom: string;
  client_telephone: string | null;
  description: string | null;
  total_ht: number;
  tva: number;
  total_ttc: number;
  validite_jours: number;
  /** AAAA-MM-JJ */
  date_validite: string | null;
  expire: boolean;
  dossier_id: number | null;
  dossier_numero: string | null;
  created_by: number | null;
  created_by_nom: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevisDetail extends DevisResume {
  client_email: string | null;
  specs: Specs;
  detail_prix: DetailPrix | null;
  notes: string | null;
  transitions: Exclude<StatutDevis, 'brouillon' | 'converti'>[];
  peut_modifier: boolean;
  peut_supprimer: boolean;
  peut_convertir: boolean;
}

export interface ListeDevisReponse {
  items: DevisResume[];
  total: number;
  page?: number;
  limit?: number;
  compteurs?: Partial<Record<StatutDevis, number>>;
}

/** Ligne d'un document (facture) : forme commune au PDF et à l'écran. */
export interface LigneDocument {
  designation: string;
  detail?: string | null;
  quantite: number | null;
  unite: string | null;
  prix_unitaire: number | null;
  total: number;
}

/** Journal d'envoi d'une facture vers VosFactures (null tant qu'aucun envoi n'a été tenté). */
export interface JournalVosFactures {
  /** Identifiant distant ; null tant que l'envoi n'a pas abouti. */
  id: number | null;
  numero: string | null;
  url: string | null;
  envoye_at: string | null;
  envoye_par_nom: string | null;
  erreur: string | null;
  erreur_at: string | null;
  tentatives: number;
  annulee_at: string | null;
  annulation_erreur: string | null;
}

export type OrigineFacture = 'dossier' | 'directe';

export interface FactureResume {
  id: number;
  numero: string;
  statut: StatutFacture;
  /** AAAA-MM-JJ */
  date_emission: string;
  /** AAAA-MM-JJ, facultative */
  date_echeance?: string | null;
  /** Null pour une facture directe (sans dossier). */
  dossier_id: number | null;
  dossier_numero?: string | null;
  origine?: OrigineFacture;
  client_id: number | null;
  client_nom: string;
  total_ht: number;
  tva_taux: number;
  tva: number;
  total_ttc: number;
  annulee_at: string | null;
  motif_annulation: string | null;
  created_at: string;
  created_by_nom: string | null;
  /** Null quand aucun paiement n'est suivi (facture directe). */
  situation_paiement?: SituationPaiement | null;
  deja_paye?: number | null;
  reste?: number | null;
  vosfactures?: JournalVosFactures | null;
}

export interface FactureDetail extends FactureResume {
  client_telephone: string | null;
  client_email: string | null;
  client_adresse: string | null;
  lignes: (LigneDocument | LignePrix)[];
  remise?: number;
  notes: string | null;
  conditions_paiement: string | null;
  annulee_par_nom: string | null;
  en_attente_validation: number;
  /** Montant actuel du dossier (peut différer du total facturé s'il a été modifié depuis). */
  dossier_montant: number | null;
  /** La liaison VosFactures est configurée (sous-domaine et clé). */
  vosfactures_actif?: boolean;
}

/** Corps de POST /factures (facture directe). */
export interface LigneFactureInput {
  designation: string;
  detail?: string | null;
  quantite: number;
  unite: string;
  prix_unitaire: number;
}

export interface FactureDirecteInput {
  client_id?: number | null;
  client_nom: string;
  client_telephone?: string | null;
  client_email?: string | null;
  client_adresse?: string | null;
  date_emission?: string;
  date_echeance?: string | null;
  lignes: LigneFactureInput[];
  remise?: number;
  notes?: string | null;
  conditions_paiement?: string | null;
}

/** Réglages de la liaison VosFactures (GET/PUT /factures/vosfactures/config, administrateur). */
export interface VendeurVosFactures {
  nom: string;
  adresse: string;
  nif: string;
  email: string;
  telephone: string;
}

export interface ConfigVosFactures {
  sous_domaine: string;
  cle_configuree: boolean;
  cle_fin: string | null;
  cle_lisible: boolean | null;
  envoi_auto: boolean;
  actif: boolean;
  vendeur: VendeurVosFactures;
  vendeur_effectif: VendeurVosFactures;
  updated_at: string | null;
  updated_by_nom: string | null;
}

export interface ConfigVosFacturesInput {
  sous_domaine?: string;
  cle?: string | null;
  envoi_auto?: boolean;
  vendeur?: Partial<VendeurVosFactures>;
}

export interface ListeFacturesReponse {
  items: FactureResume[];
  total: number;
  somme_ttc?: number;
  compteurs?: { emise: number; annulee: number };
  page?: number;
  limit?: number;
  vosfactures_actif?: boolean;
}

export interface ClientResume {
  id: number;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse?: string | null;
  nb_dossiers: number;
  total_commandes: number;
  total_paye?: number;
  reste_du: number;
  dernier_dossier_at: string | null;
}

export interface ClientRecherche {
  id: number;
  nom: string;
  telephone: string | null;
  email: string | null;
}

export interface DossierClient {
  id: number;
  numero: string;
  machine: Machine;
  statut: Statut;
  client_nom: string;
  description: string | null;
  montant: number | null;
  urgent: boolean;
  date_promise: string | null;
  created_at: string;
  livre_at: string | null;
  deja_paye: number;
}

export interface TotauxClient {
  nb_dossiers: number;
  total_commandes: number;
  total_paye: number;
  reste_du: number;
}

export interface ClientDetail {
  id: number;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  notes: string | null;
  fusionne_dans: number | null;
  fusionne_dans_nom: string | null;
  created_at: string;
  updated_at: string;
  dossiers: DossierClient[];
  totaux: TotauxClient;
}

export interface ResultatFusion extends ClientDetail {
  fusion: { source: { id: number; nom: string }; destination: { id: number; nom: string }; dossiers: number; devis: number; factures: number };
}

export interface ClientInput {
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  notes: string | null;
}

export interface Entreprise {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  ninea: string;
  rccm: string;
  pied_facture: string;
}

export interface ParametresPublics {
  entreprise: Entreprise;
  prix: { tva_applicable: boolean; tva_taux: number; arrondi_pas: number; prix_saisis_ht: boolean; surface_min_m2: number };
  fuseau: string;
}
