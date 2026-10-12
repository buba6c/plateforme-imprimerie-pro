// File de traitement des fichiers déposés : un fichier à la fois (Ghostscript est gourmand), en
// arrière-plan, sans jamais bloquer un envoi. Au démarrage, les PDF pas encore traités sont repris.
// Chaque résultat est enregistré dans fichiers.traitement (et chemin_traite si une version est retenue).

import path from 'node:path';
import { one, query } from '../../db/pool';
import { getParametres } from '../../lib/params';
import { signalDossier, type DossierSignal } from '../../realtime';
import { genreApercu } from '../fichiers/apercu';
import { traiterPdf } from './pdf';

let racine = '';
let enCours = false;
const attente: number[] = [];
let log: { info: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void } | null = null;

export function configurerTraitement(opts: { storageDir: string; log?: typeof log }) {
  racine = path.resolve(opts.storageDir);
  log = opts.log ?? null;
}

/** Ajoute un fichier à la file (sans attendre), si le traitement automatique est activé (Paramètres > Fichiers). */
export function planifierTraitement(fichierId: number) {
  if (!racine) return;
  void getParametres()
    .then((p) => {
      if (!p.fichiers.traitement_auto) return;
      if (!attente.includes(fichierId)) attente.push(fichierId);
      void suivant();
    })
    .catch(() => {});
}

async function suivant() {
  if (enCours) return;
  const id = attente.shift();
  if (id === undefined) return;
  enCours = true;
  try {
    await traiterFichier(id);
  } catch (e) {
    log?.error({ err: e, fichierId: id }, 'Traitement de fichier en échec');
  } finally {
    enCours = false;
    if (attente.length) void suivant();
  }
}

/** Traite un fichier tout de suite (utilisé par la file et par les tests). */
export async function traiterFichier(id: number) {
  const f = await one<{ id: number; dossier_id: number; nom_original: string; chemin: string; mime: string | null; deleted_at: string | null }>(
    `SELECT id, dossier_id, nom_original, chemin, mime, deleted_at FROM fichiers WHERE id = $1`,
    [id],
  );
  if (!f || f.deleted_at) return null;
  if (genreApercu(f) !== 'pdf' || !/\.pdf$/i.test(f.nom_original)) {
    await query(`UPDATE fichiers SET traitement = $2 WHERE id = $1`, [id, JSON.stringify({ statut: 'ignore', motif: 'pas un PDF', fait_le: new Date().toISOString() })]);
    return null;
  }
  const abs = path.join(racine, f.chemin);
  const rel = path.join(path.dirname(f.chemin), `traite-${path.basename(f.chemin)}`);
  const { rapport, chemin } = await traiterPdf(abs, path.join(racine, rel));
  await query(`UPDATE fichiers SET traitement = $2, chemin_traite = $3, taille_traitee = $4 WHERE id = $1`, [id, JSON.stringify(rapport), chemin ? rel : null, chemin ? rapport.taille_apres : null]);
  log?.info({ fichierId: id, statut: rapport.statut, avant: rapport.taille_avant, apres: rapport.taille_apres }, 'Fichier traité');
  const d = await one<DossierSignal>(`SELECT id, numero, statut, machine, preparateur_id, date_validation FROM dossiers WHERE id = $1`, [f.dossier_id]);
  if (d) signalDossier({ ...d, ancien_statut: d.statut });
  return rapport;
}

/**
 * Au démarrage : reprend les PDF jamais traités des dossiers encore en cours (préparation, atelier,
 * livraison), les plus récents d'abord, 200 au plus. Les dossiers livrés ne sont pas retraités.
 */
export async function reprendreTraitements() {
  if (!racine) return;
  if (!(await getParametres()).fichiers.traitement_auto) return;
  const rows = await query<{ id: number }>(
    `SELECT f.id FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id
     WHERE f.deleted_at IS NULL AND f.purge_at IS NULL AND f.traitement IS NULL AND d.deleted_at IS NULL
       AND d.statut IN ('en_cours', 'a_revoir', 'pret_impression', 'en_impression', 'pret_livraison', 'en_livraison')
       AND (f.mime = 'application/pdf' OR lower(f.nom_original) LIKE '%.pdf')
     ORDER BY f.id DESC LIMIT 200`,
  );
  for (const r of rows) planifierTraitement(r.id);
}
