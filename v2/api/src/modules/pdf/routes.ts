// GET /api/dossiers/:id/bon-de-travail.pdf : fiche atelier imprimable, sans montant ni téléphone.
// Accès : administrateur, préparateur, imprimeur de la machine du dossier (règles de visibilité
// des dossiers : un imprimeur ne voit que sa machine, une fois le dossier validé).

import { Router } from 'express';
import { query } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { intParam } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { getTarifs } from '../../lib/tarifs';
import { chargerDossier } from '../dossiers/service';
import { contentDisposition } from '../fichiers/routes';
import { pdfBonDeTravail } from './documents';

export const bonDeTravailRouter = Router();

/** Lien encodé dans le QR code : absolu si APP_URL est défini, sinon chemin relatif. */
export function lienFiche(dossierId: number): { url: string; absolu: boolean } {
  const base = (process.env.APP_URL ?? '').trim().replace(/\/+$/, '');
  return base ? { url: `${base}/dossiers/${dossierId}`, absolu: true } : { url: `/dossiers/${dossierId}`, absolu: false };
}

bonDeTravailRouter.get(
  '/:id/bon-de-travail.pdf',
  requireAuth,
  requireRole('admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox'),
  async (req, res) => {
    const user = me(req);
    const d = await chargerDossier(user, intParam(req));
    const [params, tarifs, fichiers] = await Promise.all([
      getParametres(),
      getTarifs(),
      query(
        `SELECT nom_original, taille, a_reimprimer, created_at FROM fichiers WHERE dossier_id = $1 AND deleted_at IS NULL ORDER BY created_at, id`,
        [d.id],
      ),
    ]);
    const pdf = await pdfBonDeTravail(
      {
        id: d.id,
        numero: d.numero,
        machine: d.machine,
        statut: d.statut,
        urgent: d.urgent,
        client_nom: d.client_nom,
        description: d.description,
        consignes: d.consignes,
        commentaire_revision: d.commentaire_revision,
        specs: d.specs,
        date_promise: d.date_promise,
        created_at: d.created_at,
        date_validation: d.date_validation,
        preparateur_nom: d.preparateur_nom ?? null,
        imprimeur_nom: d.imprimeur_nom ?? null,
        fichiers,
      },
      params,
      tarifs,
      lienFiche(d.id),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition(req.query.telecharger === '1' ? 'attachment' : 'inline', `Bon de travail ${d.numero}.pdf`));
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  },
);
