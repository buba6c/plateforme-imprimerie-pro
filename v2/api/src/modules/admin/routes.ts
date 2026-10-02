// Administration : journal d'audit, corbeille, exports CSV, état de santé du serveur.

import fs from 'node:fs';
import { Router, type Response } from 'express';
import { MACHINE_LABELS, MODE_PAIEMENT_LABELS, STATUT_LABELS, STATUT_PAIEMENT_LABELS, type Machine, type ModePaiement, type Statut, type StatutPaiement } from '@evocom/shared';
import type { Config } from '../../config';
import { getPool, one, query } from '../../db/pool';
import { pendingMigrations } from '../../db/migrate';
import { requireAuth, requireRole } from '../../lib/auth';
import { qInt, qList } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { contentDisposition } from '../fichiers/routes';
import { aujourdhui, Conditions, filtrePeriode, intervalle, pagination } from '../commun/requete';

// ---------------------------------------------------------------------------
// Journal d'audit

export const journalRouter = Router();
journalRouter.use(requireAuth, requireRole('admin'));

journalRouter.get('/', async (req, res) => {
  const params = await getParametres();
  const { page, limit, offset } = pagination(req, 50, 200);
  const { from, to } = intervalle(req);
  const c = new Conditions();
  const userId = qInt(req, 'user_id');
  if (userId) c.add('j.user_id = ?', userId);
  const actions = qList(req, 'action');
  if (actions?.length) c.add('j.action = ANY(?)', actions);
  const cibles = qList(req, 'cible');
  if (cibles?.length) c.add('j.cible = ANY(?)', cibles);
  filtrePeriode(c, 'j.created_at', params.fuseau, from, to);
  const total = await one<{ n: number }>(`SELECT count(*)::int AS n FROM journal j ${c.where}`, c.args);
  const items = await query(
    `SELECT j.id, j.user_id, u.nom AS user_nom, j.action, j.cible, j.cible_id, j.data, j.ip, j.created_at
     FROM journal j LEFT JOIN users u ON u.id = j.user_id
     ${c.where}
     ORDER BY j.created_at DESC, j.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    c.args,
  );
  res.json({ items, total: total?.n ?? 0, page, limit });
});

// ---------------------------------------------------------------------------
// Corbeille : dossiers supprimés (restaurables par POST /dossiers/:id/restaurer)

export const corbeilleRouter = Router();
corbeilleRouter.use(requireAuth, requireRole('admin'));

corbeilleRouter.get('/', async (_req, res) => {
  res.json(
    await query(
      `SELECT d.id, d.numero, d.machine, d.client_nom, d.statut, d.montant, d.deleted_at, d.deleted_by, u.nom AS deleted_by_nom,
              (SELECT e.commentaire FROM dossier_events e WHERE e.dossier_id = d.id AND e.type = 'suppression'
               ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS motif,
              (SELECT count(*)::int FROM paiements p WHERE p.dossier_id = d.id AND p.statut <> 'refuse') AS nb_paiements
       FROM dossiers d LEFT JOIN users u ON u.id = d.deleted_by
       WHERE d.deleted_at IS NOT NULL
       ORDER BY d.deleted_at DESC, d.id DESC
       LIMIT 500`,
    ),
  );
});

// ---------------------------------------------------------------------------
// Exports CSV : séparateur « ; », UTF-8 avec BOM (ouverture directe dans Excel),
// montants en entiers bruts (FCFA), dates jj/mm/aaaa hh:mm dans le fuseau de l'entreprise.

const TELEPHONE_RE = /^[+-][0-9 ().-]*$/;

/** Cellule CSV échappée ; neutralise les formules (=, +, -, @) sauf les numéros de téléphone. */
export function celluleCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  let s = String(v);
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !TELEPHONE_RE.test(s))) s = `'${s}`;
  if (/[;"\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csv(entetes: string[], lignes: unknown[][]): string {
  const out = [entetes.map(celluleCsv).join(';'), ...lignes.map((l) => l.map(celluleCsv).join(';'))];
  return `﻿${out.join('\r\n')}\r\n`;
}

function envoyerCsv(res: Response, nom: string, contenu: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', contentDisposition('attachment', nom));
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(contenu);
}

function decimalFr(n: number | null): string {
  if (n === null || n === undefined) return '';
  return String(Number(n)).replace('.', ',');
}

const DH = (col: string, tz: string) => `to_char(${col} AT TIME ZONE ${tz}, 'DD/MM/YYYY HH24:MI')`;

export const exportsRouter = Router();
exportsRouter.use(requireAuth, requireRole('admin'));

exportsRouter.get('/dossiers.csv', async (req, res) => {
  const params = await getParametres();
  const { from, to } = intervalle(req);
  const c = new Conditions().add('d.deleted_at IS NULL');
  const tz = c.param(params.fuseau);
  filtrePeriode(c, 'd.created_at', params.fuseau, from, to);
  const rows = await query(
    `SELECT d.numero, ${DH('d.created_at', tz)} AS cree_le, d.client_nom, d.client_telephone, d.machine, d.statut,
            prep.nom AS preparateur, d.description, d.montant,
            coalesce((SELECT sum(p.montant) FROM paiements p WHERE p.dossier_id = d.id AND p.statut = 'valide'), 0)::bigint AS paye,
            d.urgent, to_char(d.date_promise, 'DD/MM/YYYY') AS date_promise, ${DH('d.livre_at', tz)} AS livre_le,
            (SELECT f.numero FROM factures f WHERE f.dossier_id = d.id AND f.statut = 'emise' LIMIT 1) AS facture
     FROM dossiers d LEFT JOIN users prep ON prep.id = d.preparateur_id
     ${c.where}
     ORDER BY d.created_at, d.id`,
    c.args,
  );
  const contenu = csv(
    ['Numéro', 'Créé le', 'Client', 'Téléphone', 'Machine', 'Statut', 'Préparateur', 'Description', 'Montant (FCFA)', 'Payé (FCFA)', 'Reste à payer (FCFA)', 'Urgent', 'Date promise', 'Livré le', 'Facture'],
    rows.map((r) => [
      r.numero,
      r.cree_le,
      r.client_nom,
      r.client_telephone,
      MACHINE_LABELS[r.machine as Machine] ?? r.machine,
      STATUT_LABELS[r.statut as Statut] ?? r.statut,
      r.preparateur,
      r.description,
      r.montant,
      r.paye,
      r.montant === null ? null : Math.max(0, r.montant - r.paye),
      r.urgent,
      r.date_promise,
      r.livre_le,
      r.facture,
    ]),
  );
  envoyerCsv(res, `dossiers_${from ?? 'debut'}_${to ?? aujourdhui(params.fuseau)}.csv`, contenu);
});

exportsRouter.get('/paiements.csv', async (req, res) => {
  const params = await getParametres();
  const { from, to } = intervalle(req);
  const c = new Conditions();
  const tz = c.param(params.fuseau);
  filtrePeriode(c, 'p.encaisse_at', params.fuseau, from, to);
  const rows = await query(
    `SELECT ${DH('p.encaisse_at', tz)} AS encaisse_le, d.numero, d.client_nom, p.montant, p.mode, p.reference, p.statut,
            ue.nom AS encaisse_par, uv.nom AS decide_par, ${DH('p.valide_at', tz)} AS decide_le, p.motif_refus, p.notes,
            (d.deleted_at IS NOT NULL) AS dossier_supprime
     FROM paiements p JOIN dossiers d ON d.id = p.dossier_id
     LEFT JOIN users ue ON ue.id = p.encaisse_par LEFT JOIN users uv ON uv.id = p.valide_par
     ${c.where}
     ORDER BY p.encaisse_at, p.id`,
    c.args,
  );
  const contenu = csv(
    ['Encaissé le', 'Dossier', 'Client', 'Montant (FCFA)', 'Mode', 'Référence', 'Statut', 'Encaissé par', 'Validé ou refusé par', 'Validé ou refusé le', 'Motif du refus', 'Notes', 'Dossier supprimé'],
    rows.map((r) => [
      r.encaisse_le,
      r.numero,
      r.client_nom,
      r.montant,
      MODE_PAIEMENT_LABELS[r.mode as ModePaiement] ?? r.mode,
      r.reference,
      STATUT_PAIEMENT_LABELS[r.statut as StatutPaiement] ?? r.statut,
      r.encaisse_par,
      r.decide_par,
      r.decide_le,
      r.motif_refus,
      r.notes,
      r.dossier_supprime,
    ]),
  );
  envoyerCsv(res, `paiements_${from ?? 'debut'}_${to ?? aujourdhui(params.fuseau)}.csv`, contenu);
});

exportsRouter.get('/factures.csv', async (req, res) => {
  const params = await getParametres();
  const { from, to } = intervalle(req);
  const c = new Conditions();
  const tz = c.param(params.fuseau);
  if (from) c.add('f.date_emission >= ?::date', from);
  if (to) c.add('f.date_emission <= ?::date', to);
  const rows = await query(
    `SELECT f.numero, to_char(f.date_emission, 'DD/MM/YYYY') AS emise_le, d.numero AS dossier, f.client_nom,
            f.total_ht, f.tva_taux, f.tva, f.total_ttc, f.statut, ${DH('f.annulee_at', tz)} AS annulee_le, f.motif_annulation
     FROM factures f JOIN dossiers d ON d.id = f.dossier_id
     ${c.where}
     ORDER BY f.date_emission, f.numero`,
    c.args,
  );
  const contenu = csv(
    ['Numéro', "Date d'émission", 'Dossier', 'Client', 'Total HT (FCFA)', 'Taux de TVA (%)', 'TVA (FCFA)', 'Total TTC (FCFA)', 'Statut', 'Annulée le', "Motif d'annulation"],
    rows.map((r) => [
      r.numero,
      r.emise_le,
      r.dossier,
      r.client_nom,
      r.total_ht,
      decimalFr(r.tva_taux),
      r.tva,
      r.total_ttc,
      r.statut === 'annulee' ? 'Annulée' : 'Émise',
      r.annulee_le,
      r.motif_annulation,
    ]),
  );
  envoyerCsv(res, `factures_${from ?? 'debut'}_${to ?? aujourdhui(params.fuseau)}.csv`, contenu);
});

// ---------------------------------------------------------------------------
// Santé

export function santeRouter(config: Config) {
  const router = Router();
  router.use(requireAuth, requireRole('admin'));

  router.get('/', async (_req, res) => {
    const debut = Date.now();
    const base = await one('SELECT 1 AS ok')
      .then(() => ({ ok: true, latence_ms: Date.now() - debut }))
      .catch((e: Error) => ({ ok: false, erreur: `Base de données injoignable : ${e.message}` }));

    let stockage: { chemin: string; libre_octets: number | null; total_octets: number | null; erreur?: string };
    try {
      const s = await fs.promises.statfs(config.storageDir);
      stockage = { chemin: config.storageDir, libre_octets: Number(s.bavail) * Number(s.bsize), total_octets: Number(s.blocks) * Number(s.bsize) };
    } catch (e) {
      stockage = {
        chemin: config.storageDir,
        libre_octets: null,
        total_octets: null,
        erreur: `Répertoire de stockage illisible (${(e as Error).message}) : vérifiez STORAGE_DIR et les droits du service.`,
      };
    }

    const sauvegarde = base.ok
      ? await one(`SELECT ok, created_at, taille, message, fichier FROM sauvegardes ORDER BY created_at DESC, id DESC LIMIT 1`).catch(() => null)
      : null;

    let migrations: { a_jour: boolean; en_attente: string[] } | { a_jour: null; erreur: string };
    try {
      const enAttente = await pendingMigrations(getPool());
      migrations = { a_jour: enAttente.length === 0, en_attente: enAttente };
    } catch (e) {
      migrations = { a_jour: null, erreur: `État des migrations inconnu : ${(e as Error).message}` };
    }

    res.json({
      version: process.env.npm_package_version ?? '2.0.0',
      base,
      stockage,
      derniere_sauvegarde: sauvegarde
        ? { ok: sauvegarde.ok, created_at: sauvegarde.created_at, taille: sauvegarde.taille, message: sauvegarde.message, fichier: sauvegarde.fichier }
        : null,
      migrations,
    });
  });

  return router;
}
