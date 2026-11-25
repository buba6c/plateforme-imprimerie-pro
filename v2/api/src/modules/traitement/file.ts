// File de traitement des fichiers déposés : un fichier à la fois (Ghostscript est gourmand), en
// arrière-plan, sans jamais bloquer un envoi. Au démarrage, les PDF pas encore traités sont repris.
// Chaque résultat est enregistré dans fichiers.traitement (et chemin_traite si une version est retenue).

import fs from 'node:fs';
import os from 'node:os';
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

/** Un fichier dont le traitement a déjà été interrompu (plantage, arrêt du serveur) ce nombre de fois n'est plus retenté. */
export const TENTATIVES_MAX = 2;

export function configurerTraitement(opts: { storageDir: string; log?: typeof log }) {
  racine = path.resolve(opts.storageDir);
  log = opts.log ?? null;
  void nettoyerTemporaires();
}

/**
 * Au démarrage : dossiers et fichiers de travail laissés dans /tmp par un processus arrêté en plein travail
 * (traitement, imposition, analyse). Le 13/11/2026, 59 dossiers d'1 Go ont rempli le disque.
 */
export async function nettoyerTemporaires(dir = os.tmpdir(), ageMinMs = 30 * 60 * 1000): Promise<number> {
  let n = 0;
  try {
    for (const nom of await fs.promises.readdir(dir)) {
      if (!/^evocom-(traitement|imposition|bordure|securite)-/.test(nom)) continue;
      const p = path.join(dir, nom);
      const st = await fs.promises.stat(p).catch(() => null);
      if (!st || Date.now() - st.mtimeMs < ageMinMs) continue;
      await fs.promises.rm(p, { recursive: true, force: true }).catch(() => {});
      n++;
    }
  } catch {
    /* répertoire temporaire illisible : rien à faire */
  }
  if (n) log?.info({ supprimes: n }, 'Fichiers de travail abandonnés supprimés');
  return n;
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
  const f = await one<{ id: number; dossier_id: number; nom_original: string; chemin: string; mime: string | null; deleted_at: string | null; traitement: { statut?: string; tentatives?: number } | null }>(
    `SELECT id, dossier_id, nom_original, chemin, mime, deleted_at, traitement FROM fichiers WHERE id = $1`,
    [id],
  );
  if (!f || f.deleted_at) return null;
  if (f.traitement && f.traitement.statut !== 'en_cours') return null; // déjà traité
  if (genreApercu(f) !== 'pdf' || !/\.pdf$/i.test(f.nom_original)) {
    await query(`UPDATE fichiers SET traitement = $2 WHERE id = $1`, [id, JSON.stringify({ statut: 'ignore', motif: 'pas un PDF', fait_le: new Date().toISOString() })]);
    return null;
  }
  // Garde contre une boucle de plantages : chaque tentative est notée avant de commencer ; un fichier déjà
  // interrompu TENTATIVES_MAX fois est laissé tel quel (l'original reste servi).
  const tentatives = (f.traitement?.statut === 'en_cours' ? f.traitement.tentatives ?? 1 : 0) + 1;
  if (tentatives > TENTATIVES_MAX) {
    const rapport = {
      statut: 'erreur',
      outils: [],
      repare: false,
      taille_avant: null,
      taille_apres: null,
      pages: null,
      polices_non_incorporees: [],
      dpi_min: null,
      avertissements: [`Traitement interrompu ${TENTATIVES_MAX} fois (fichier trop lourd pour le serveur) : l’original est servi tel quel.`],
      duree_ms: 0,
      fait_le: new Date().toISOString(),
    };
    await query(`UPDATE fichiers SET traitement = $2 WHERE id = $1`, [id, JSON.stringify(rapport)]);
    log?.error({ fichierId: id, tentatives: tentatives - 1 }, 'Traitement abandonné après plusieurs interruptions');
    return null;
  }
  await query(`UPDATE fichiers SET traitement = $2 WHERE id = $1`, [id, JSON.stringify({ statut: 'en_cours', tentatives, debut: new Date().toISOString() })]);
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
     WHERE f.deleted_at IS NULL AND f.purge_at IS NULL AND (f.traitement IS NULL OR f.traitement->>'statut' = 'en_cours') AND d.deleted_at IS NULL
       AND d.statut IN ('en_cours', 'a_revoir', 'pret_impression', 'en_impression', 'pret_livraison', 'en_livraison')
       AND (f.mime = 'application/pdf' OR lower(f.nom_original) LIKE '%.pdf')
     ORDER BY f.id DESC LIMIT 200`,
  );
  for (const r of rows) planifierTraitement(r.id);
}
