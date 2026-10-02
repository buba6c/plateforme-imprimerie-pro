// Libellés du journal d'audit et résumé lisible de ses données (clé : valeur).
import { formatFCFA, MACHINE_LABELS, MODE_PAIEMENT_LABELS, ROLE_LABELS, STATUT_LABELS, UNITE_TARIF_LABELS } from '@evocom/shared';

export const ACTION_LABELS: Record<string, string> = {
  utilisateur_cree: 'Utilisateur créé',
  utilisateur_modifie: 'Utilisateur modifié',
  mot_de_passe_reinitialise: 'Mot de passe réinitialisé',
  mot_de_passe_change: 'Mot de passe changé',
  tarif_cree: 'Tarif ajouté',
  tarif_modifie: 'Tarif modifié',
  parametres_modifies: 'Paramètres modifiés',
  paiement_valide: 'Paiement validé',
  paiement_refuse: 'Paiement refusé',
  facture_emise: 'Facture émise',
  facture_annulee: 'Facture annulée',
  client_modifie: 'Client modifié',
  client_fusionne: 'Clients fusionnés',
};

export function libelleAction(a: string): string {
  if (ACTION_LABELS[a]) return ACTION_LABELS[a];
  const s = a.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const CIBLE_LABELS: Record<string, string> = {
  user: 'Utilisateur',
  tarif: 'Tarif',
  parametres: 'Paramètres',
  paiement: 'Paiement',
  facture: 'Facture',
  client: 'Client',
  dossier: 'Dossier',
  devis: 'Devis',
};

const CLE_LABELS: Record<string, string> = {
  email: 'e-mail',
  role: 'rôle',
  nom: 'nom',
  telephone: 'téléphone',
  is_active: 'actif',
  actif: 'actif',
  prix: 'prix',
  libelle: 'libellé',
  unite: 'unité',
  categorie: 'catégorie',
  machine: 'machine',
  description: 'description',
  montant: 'montant',
  mode: 'mode',
  motif: 'motif',
  numero: 'numéro',
  dossier_numero: 'dossier',
  total_ttc: 'total TTC',
  arrondi_pas: 'arrondi',
  tva_applicable: 'TVA',
  tva_taux: 'taux de TVA',
  prix_saisis_ht: 'prix saisis HT',
  surface_min_m2: 'surface minimale',
  livreur_jours_historique: 'historique livreur (jours)',
  fuseau: 'fuseau',
  pied_facture: 'pied de facture',
  ninea: 'NINEA',
  rccm: 'RCCM',
  adresse: 'adresse',
  dans_id: 'fusionné dans',
  source: 'client fusionné',
  destination: 'conservé',
  dossiers: 'dossiers déplacés',
  devis: 'devis déplacés',
  factures: 'factures déplacées',
};

const MASQUEES = new Set(['dossier_id', 'paiement_id']);
const MONTANTS = new Set(['montant', 'total_ttc', 'total_ht', 'tva', 'arrondi_pas']);

function valeur(cle: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  if (typeof v === 'number') {
    if (MONTANTS.has(cle)) return formatFCFA(v);
    if (cle === 'prix') return `${v.toLocaleString('fr-FR')}`;
    if (cle === 'tva_taux') return `${v.toLocaleString('fr-FR')} %`;
    if (cle === 'surface_min_m2') return `${v.toLocaleString('fr-FR')} m²`;
    return v.toLocaleString('fr-FR');
  }
  if (typeof v === 'string') {
    if (cle === 'role') return ROLE_LABELS[v as keyof typeof ROLE_LABELS] ?? v;
    if (cle === 'mode') return MODE_PAIEMENT_LABELS[v as keyof typeof MODE_PAIEMENT_LABELS] ?? v;
    if (cle === 'machine') return v === 'global' ? 'Commun' : (MACHINE_LABELS[v as keyof typeof MACHINE_LABELS] ?? v);
    if (cle === 'unite') return UNITE_TARIF_LABELS[v as keyof typeof UNITE_TARIF_LABELS] ?? v;
    if (cle === 'statut') return STATUT_LABELS[v as keyof typeof STATUT_LABELS] ?? v;
    return v.length > 80 ? `${v.slice(0, 77)}…` : v;
  }
  if (Array.isArray(v)) return v.map((x) => valeur(cle, x)).join(', ');
  return JSON.stringify(v);
}

function libelleCle(chemin: string[]): string {
  return chemin.map((c) => CLE_LABELS[c] ?? c.replace(/_/g, ' ')).join(' · ');
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Liste de paires « clé : valeur » ; un couple { avant, apres } devient « clé : ancien → nouveau ». */
export function resumerDonnees(data: unknown): { cle: string; valeur: string }[] {
  const out: { cle: string; valeur: string }[] = [];
  const visiter = (v: unknown, chemin: string[]) => {
    if (out.length >= 14) return;
    if (estObjet(v) && 'avant' in v && 'apres' in v) {
      const avant = v.avant;
      const apres = v.apres;
      if (estObjet(apres)) {
        for (const k of Object.keys(apres)) {
          const a = estObjet(avant) ? avant[k] : undefined;
          if (JSON.stringify(a) === JSON.stringify(apres[k])) continue;
          if (estObjet(apres[k])) visiter({ avant: a, apres: apres[k] }, [...chemin, k]);
          else out.push({ cle: libelleCle([...chemin, k]), valeur: `${valeur(k, a)} → ${valeur(k, apres[k])}` });
        }
      } else {
        const k = chemin[chemin.length - 1] ?? '';
        out.push({ cle: libelleCle(chemin), valeur: `${valeur(k, avant)} → ${valeur(k, apres)}` });
      }
      return;
    }
    if (estObjet(v)) {
      // Une entité { id, nom } se résume à son nom.
      if (chemin.length && typeof v.nom === 'string') {
        out.push({ cle: libelleCle(chemin), valeur: valeur('nom', v.nom) });
        return;
      }
      for (const [k, x] of Object.entries(v)) {
        if (MASQUEES.has(k)) continue;
        visiter(x, [...chemin, k]);
      }
      return;
    }
    const k = chemin[chemin.length - 1] ?? '';
    out.push({ cle: libelleCle(chemin), valeur: valeur(k, v) });
  };
  if (data !== null && data !== undefined) visiter(data, []);
  return out;
}
