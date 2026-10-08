// Validation des paiements par l'administrateur : un paiement, un groupe (sélection de la liste)
// ou l'historique importé de l'ancienne plateforme.
//
// Mêmes règles partout, appliquées dans la transaction après la prise des verrous :
// - seul un paiement « à valider » peut être validé ;
// - un paiement d'un dossier mis à la corbeille n'est pas validé (restaurer le dossier d'abord) ;
// - le total validé d'un dossier ne dépasse jamais son montant : les sommes sont relues APRÈS
//   le verrou du dossier (défaut A8 de l'audit du 8 octobre 2026), et cumulées paiement après
//   paiement quand plusieurs paiements du même dossier sont validés ensemble.
//
// Ordre des verrous : paiements (par id croissant) puis dossiers (par id croissant), comme la
// validation unitaire qui verrouille le paiement puis son dossier ; l'encaissement verrouille le
// dossier puis insère un nouveau paiement, qu'aucune validation ne peut attendre.

import { formatFCFA } from '@evocom/shared';
import type { Db } from '../../db/pool';
import { query } from '../../db/pool';

export interface PaiementVerrouille {
  id: number;
  dossier_id: number;
  montant: number;
  mode: string;
  statut: string;
  encaisse_par: number | null;
  encaisse_at: string | Date;
  legacy_id: number | null;
}

export interface DossierVerrouille {
  id: number;
  numero: string;
  client_nom: string;
  montant: number | null;
  statut: string;
  deleted_at: string | null;
  deja_paye: number;
}

export interface Refus {
  id: number;
  numero: string | null;
  code: 'introuvable' | 'deja_valide' | 'refuse' | 'dossier_supprime' | 'depassement';
  message: string;
  details?: { deja_paye: number; montant_dossier: number };
}

/** Verrouille les paiements demandés (ordre des id) et renvoie ceux qui existent. */
export async function verrouillerPaiements(db: Db, ids: number[]): Promise<PaiementVerrouille[]> {
  return query<PaiementVerrouille>(
    `SELECT id, dossier_id, montant, mode, statut, encaisse_par, encaisse_at, legacy_id
     FROM paiements WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
    [ids],
    db,
  );
}

/**
 * Verrouille les dossiers puis relit, dans une requête distincte (donc avec un instantané pris
 * après l'obtention des verrous), le total déjà validé de chacun.
 */
export async function verrouillerDossiers(db: Db, ids: number[]): Promise<Map<number, DossierVerrouille>> {
  const uniques = [...new Set(ids)].sort((a, b) => a - b);
  if (!uniques.length) return new Map();
  await query(`SELECT id FROM dossiers WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`, [uniques], db);
  const rows = await query<DossierVerrouille>(
    `SELECT d.id, d.numero, d.client_nom, d.montant, d.statut, d.deleted_at,
            coalesce((SELECT sum(p.montant) FROM paiements p WHERE p.dossier_id = d.id AND p.statut = 'valide'), 0)::bigint AS deja_paye
     FROM dossiers d WHERE d.id = ANY($1::int[])`,
    [uniques],
    db,
  );
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Décide, paiement par paiement, lesquels peuvent être validés. Les paiements d'un même dossier
 * sont examinés du plus ancien au plus récent ; chaque paiement accepté s'ajoute au déjà payé.
 */
export function trier(paiements: PaiementVerrouille[], dossiers: Map<number, DossierVerrouille>) {
  const acceptes: PaiementVerrouille[] = [];
  const refuses: Refus[] = [];
  const cumul = new Map<number, number>();
  const ordre = [...paiements].sort(
    (a, b) => a.dossier_id - b.dossier_id || new Date(a.encaisse_at).getTime() - new Date(b.encaisse_at).getTime() || a.id - b.id,
  );
  for (const p of ordre) {
    const d = dossiers.get(p.dossier_id);
    const numero = d?.numero ?? null;
    if (p.statut === 'valide') {
      refuses.push({ id: p.id, numero, code: 'deja_valide', message: 'Ce paiement est déjà validé.' });
      continue;
    }
    if (p.statut !== 'a_valider') {
      refuses.push({ id: p.id, numero, code: 'refuse', message: 'Ce paiement a été refusé : il ne peut plus être validé. Faites saisir un nouvel encaissement.' });
      continue;
    }
    if (!d) {
      refuses.push({ id: p.id, numero, code: 'introuvable', message: "Le dossier de ce paiement n'existe plus." });
      continue;
    }
    if (d.deleted_at) {
      refuses.push({
        id: p.id,
        numero,
        code: 'dossier_supprime',
        message: `Le dossier ${d.numero} est dans la corbeille : restaurez-le avant de valider ce paiement, ou refusez le paiement.`,
      });
      continue;
    }
    const deja = cumul.get(d.id) ?? d.deja_paye;
    if (d.montant !== null && deja + p.montant > d.montant) {
      refuses.push({
        id: p.id,
        numero,
        code: 'depassement',
        message: `Valider ce paiement de ${formatFCFA(p.montant)} porterait le total encaissé à ${formatFCFA(deja + p.montant)} pour un dossier de ${formatFCFA(d.montant)}. Refusez-le, ou corrigez d'abord le montant du dossier.`,
        details: { deja_paye: deja, montant_dossier: d.montant },
      });
      continue;
    }
    cumul.set(d.id, deja + p.montant);
    acceptes.push(p);
  }
  return { acceptes, refuses };
}

/** Passe les paiements acceptés à « validé » et ajoute un événement à l'historique de chaque dossier. */
export async function appliquerValidation(db: Db, adminId: number, acceptes: PaiementVerrouille[], origine?: 'groupe' | 'historique') {
  if (!acceptes.length) return;
  const ids = acceptes.map((p) => p.id);
  await query(`UPDATE paiements SET statut = 'valide', valide_par = $2, valide_at = now(), motif_refus = NULL WHERE id = ANY($1::int[])`, [ids, adminId], db);
  await query(
    `INSERT INTO dossier_events (dossier_id, user_id, type, action, data)
     SELECT x.dossier_id, $2, 'paiement', 'valide',
            jsonb_strip_nulls(jsonb_build_object('paiement_id', x.id, 'montant', x.montant, 'mode', x.mode, 'origine', $3::text))
     FROM unnest($1::int[], $4::int[], $5::int[], $6::text[]) AS x(id, dossier_id, montant, mode)`,
    [ids, adminId, origine ?? null, acceptes.map((p) => p.dossier_id), acceptes.map((p) => p.montant), acceptes.map((p) => p.mode)],
    db,
  );
}
