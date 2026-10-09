// Texte des messages : modèle de l'événement + variables du dossier ({client}, {numero}, {travail},
// {montant}, {adresse}, {entreprise}, {date}). Le texte est figé au moment de la planification.

import { formatFCFA, resumeLigne, type LigneRoland, type LigneXerox, type Machine } from '@evocom/shared';
import type { Db } from '../../db/pool';
import { getParametres } from '../../lib/params';
import { getTarifs } from '../../lib/tarifs';
import type { EvenementWhatsApp, ParametresWhatsApp, VariableModele } from './parametres';

/** Colonnes de `dossiers` utiles au message (une ligne complète convient). */
export interface DossierPourMessage {
  numero: string;
  client_nom: string;
  machine: Machine;
  specs: unknown;
  description: string | null;
  montant: number | null;
  adresse_livraison?: string | null;
  livraison_prevue_at?: string | Date | null;
}

export type Variables = Record<VariableModele, string>;

/** « Bâche standard · 300 × 200 cm · 1 ex. », comme sur les fiches (sans les prix). */
async function travail(d: DossierPourMessage, db?: Db): Promise<string> {
  const specs = d.specs as { lignes?: (LigneRoland | LigneXerox)[] } | null;
  const lignes = specs?.lignes ?? [];
  if (!lignes.length) return d.description?.trim() || 'votre travail';
  const first = lignes[0]!;
  let libelle: string = first.support;
  try {
    const tarifs = await getTarifs(db);
    libelle = tarifs.find((t) => t.code === first.support && (t.machine === d.machine || t.machine === 'global'))?.libelle ?? first.support;
  } catch {
    /* tarifs illisibles : code brut */
  }
  const base = resumeLigne(d.machine, first, libelle);
  return lignes.length > 1 ? `${base} + ${lignes.length - 1} autre${lignes.length > 2 ? 's' : ''}` : base;
}

/** Date de livraison lisible dans le fuseau de l'entreprise : « jeudi 9 octobre à 14:00 ». */
export function dateLisible(valeur: string | Date | null | undefined, fuseau: string): string {
  if (!valeur) return 'date à confirmer';
  const sansHeure = typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur);
  const d = sansHeure ? new Date(`${valeur}T12:00:00Z`) : new Date(valeur);
  if (Number.isNaN(d.getTime())) return 'date à confirmer';
  const fmt = (o: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, ...o }).format(d);
    } catch {
      return new Intl.DateTimeFormat('fr-FR', o).format(d);
    }
  };
  const jour = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
  const heure = fmt({ hour: '2-digit', minute: '2-digit' });
  return sansHeure || heure === '00:00' ? jour : `${jour} à ${heure}`;
}

export async function variablesDossier(d: DossierPourMessage, db?: Db): Promise<Variables> {
  const p = await getParametres(db);
  return {
    client: d.client_nom.trim() || 'cher client',
    numero: d.numero,
    travail: await travail(d, db),
    montant: d.montant === null || d.montant === undefined ? '' : formatFCFA(d.montant),
    adresse: p.entreprise.adresse.trim(),
    entreprise: p.entreprise.nom.trim() || 'notre imprimerie',
    date: dateLisible(d.livraison_prevue_at, p.fuseau),
  };
}

/** Remplace les variables, nettoie les restes (« , » d'une adresse vide) et ajoute la signature. */
export function rendreModele(modele: string, v: Variables, signature = ''): string {
  let texte = modele.replace(/\{([a-z_]+)\}/g, (tout, cle: string) => (cle in v ? v[cle as keyof Variables] : tout));
  texte = texte
    .replace(/[ \t]+/g, ' ')
    .replace(/ ,/g, ',')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/,\s*$/gm, '')
    .replace(/\(\s*\)/g, '')
    .replace(/ +\./g, '.')
    .trim();
  if (signature.trim()) texte += `\n${signature.trim()}`;
  return texte.slice(0, 1000);
}

export async function texteEvenement(evenement: EvenementWhatsApp, d: DossierPourMessage, p: ParametresWhatsApp, db?: Db): Promise<string> {
  return rendreModele(p.modeles[evenement], await variablesDossier(d, db), p.signature);
}

/** Variables d'exemple pour l'aperçu des modèles dans l'interface. */
export const VARIABLES_EXEMPLE: Variables = {
  client: 'Awa Diop',
  numero: 'CMD-2026-0042',
  travail: 'Bâche standard · 300 × 200 cm · 1 ex.',
  montant: '45 000 FCFA',
  adresse: 'Sacré-Cœur 3, Dakar',
  entreprise: 'Evocom Print',
  date: 'jeudi 9 octobre à 14:00',
};
