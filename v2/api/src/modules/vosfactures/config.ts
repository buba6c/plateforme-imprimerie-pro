// Configuration du compte VosFactures (une seule ligne) : sous-domaine, clé API chiffrée au repos
// avec le même mécanisme que la clé OpenAI (AES-256-GCM, modules/ia/chiffrement.ts), envoi
// automatique, vendeur par défaut. L'administrateur ne revoit jamais la clé : seulement sa fin.

import { one, type Db } from '../../db/pool';
import { conflict, HttpError } from '../../lib/errors';
import type { Entreprise } from '../../lib/params';
import { chiffrer, CleIllisible, dechiffrer } from '../ia/chiffrement';
import type { CompteVosFactures } from './client';

export interface VendeurVosFactures {
  nom: string;
  adresse: string;
  nif: string;
  email: string;
  telephone: string;
}

export interface ConfigVosFactures {
  sous_domaine: string;
  cle_chiffree: string | null;
  cle_fin: string | null;
  envoi_auto: boolean;
  vendeur: Partial<VendeurVosFactures>;
  updated_at: string | null;
  updated_by_nom: string | null;
}

export const VENDEUR_VIDE: VendeurVosFactures = { nom: '', adresse: '', nif: '', email: '', telephone: '' };

export async function lireConfigVosFactures(db?: Db): Promise<ConfigVosFactures> {
  const c = await one<ConfigVosFactures>(
    `SELECT c.sous_domaine, c.cle_chiffree, c.cle_fin, c.envoi_auto, c.vendeur, c.updated_at, u.nom AS updated_by_nom
     FROM vosfactures_config c LEFT JOIN users u ON u.id = c.updated_by WHERE c.id = 1`,
    [],
    db,
  );
  return c ?? { sous_domaine: '', cle_chiffree: null, cle_fin: null, envoi_auto: false, vendeur: {}, updated_at: null, updated_by_nom: null };
}

export async function ecrireConfigVosFactures(db: Db, c: { sous_domaine: string; cle_chiffree: string | null; cle_fin: string | null; envoi_auto: boolean; vendeur: VendeurVosFactures }, userId: number) {
  await db.query(
    `INSERT INTO vosfactures_config (id, sous_domaine, cle_chiffree, cle_fin, envoi_auto, vendeur, updated_by, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (id) DO UPDATE SET sous_domaine = EXCLUDED.sous_domaine, cle_chiffree = EXCLUDED.cle_chiffree, cle_fin = EXCLUDED.cle_fin,
       envoi_auto = EXCLUDED.envoi_auto, vendeur = EXCLUDED.vendeur, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [c.sous_domaine, c.cle_chiffree, c.cle_fin, c.envoi_auto, JSON.stringify(c.vendeur), userId],
  );
}

export function chiffrerCle(cle: string): { cle_chiffree: string; cle_fin: string } {
  return { cle_chiffree: chiffrer(cle), cle_fin: cle.slice(-4) };
}

function cleLisible(c: ConfigVosFactures): boolean {
  if (!c.cle_chiffree) return false;
  try {
    dechiffrer(c.cle_chiffree);
    return true;
  } catch {
    return false;
  }
}

/** La liaison est utilisable : sous-domaine et clé enregistrés. */
export function liaisonConfiguree(c: ConfigVosFactures): boolean {
  return !!c.sous_domaine && !!c.cle_chiffree;
}

/** Vendeur envoyé à VosFactures : réglages de la section, complétés par Paramètres > Entreprise. */
export function vendeurEffectif(c: ConfigVosFactures, entreprise: Entreprise): VendeurVosFactures {
  const v = c.vendeur ?? {};
  return {
    nom: (v.nom ?? '').trim() || entreprise.nom,
    adresse: (v.adresse ?? '').trim() || entreprise.adresse,
    nif: (v.nif ?? '').trim() || entreprise.ninea,
    email: (v.email ?? '').trim() || entreprise.email,
    telephone: (v.telephone ?? '').trim() || entreprise.telephone,
  };
}

/** Ce que voit l'administrateur : jamais la clé, seulement ses 4 derniers caractères. */
export function vueConfigVosFactures(c: ConfigVosFactures, entreprise: Entreprise) {
  const configuree = !!c.cle_chiffree;
  return {
    sous_domaine: c.sous_domaine,
    cle_configuree: configuree,
    cle_fin: configuree ? c.cle_fin : null,
    cle_lisible: configuree ? cleLisible(c) : null,
    envoi_auto: c.envoi_auto && liaisonConfiguree(c),
    actif: liaisonConfiguree(c),
    vendeur: { ...VENDEUR_VIDE, ...(c.vendeur ?? {}) },
    vendeur_effectif: vendeurEffectif(c, entreprise),
    updated_at: c.updated_at,
    updated_by_nom: c.updated_by_nom,
  };
}

/** Compte prêt à l'appel (clé en clair) ; 409 si rien n'est configuré ou si le secret de chiffrement a changé. */
export function compteEnClair(c: ConfigVosFactures): CompteVosFactures {
  if (!c.sous_domaine || !c.cle_chiffree) {
    throw conflict("La liaison VosFactures n'est pas configurée : renseignez le sous-domaine et la clé API dans Paramètres > Facturation.");
  }
  try {
    return { sousDomaine: c.sous_domaine, cle: dechiffrer(c.cle_chiffree) };
  } catch (e) {
    if (e instanceof CleIllisible) throw new HttpError(409, `La clé VosFactures ${e.message.charAt(0).toLowerCase()}${e.message.slice(1)}`, undefined, 'vosfactures_cle_illisible');
    throw e;
  }
}
