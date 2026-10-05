// Contrôle du stockage (administrateur) : fichiers enregistrés mais absents du disque,
// tailles différentes, fichiers non référencés, place occupée.

import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { formatDateHeure, formatDecimal, formatEntier, formatTaille } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Card, Kpi, LoadingRows } from '../../ui';
import { useIntegrite } from './hooks';
import type { EtatFichier, FichierControle } from './types';

const ETAT_LABELS: Record<EtatFichier, string> = {
  actif: 'Dossier actif',
  corbeille: 'Fichier à la corbeille',
  dossier_corbeille: 'Dossier à la corbeille',
};

const pluriel = (n: number, mot: string, pl = `${mot}s`) => `${formatEntier(n)} ${n > 1 ? pl : mot}`;

function TableControle({ items, avecTailleDisque }: { items: FichierControle[]; avecTailleDisque?: boolean }) {
  return (
    <div className="ev-table-wrap">
      <table className="ev-table">
        <thead>
          <tr>
            <th scope="col">Fichier</th>
            <th scope="col">Dossier</th>
            <th scope="col">État</th>
            <th scope="col" style={{ textAlign: 'right' }}>
              {avecTailleDisque ? 'Enregistrée' : 'Taille'}
            </th>
            {avecTailleDisque && (
              <th scope="col" style={{ textAlign: 'right' }}>
                Sur le disque
              </th>
            )}
            <th scope="col">Envoyé le</th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id}>
              <td>
                <span className="ev-cell-main" style={{ overflowWrap: 'anywhere' }}>
                  {f.nom_original}
                </span>
                <span className="fa-chemin" title="Chemin attendu dans le dossier de stockage">
                  {f.chemin}
                </span>
                {f.importe && <span className="fa-sub">Importé de l’ancienne plateforme</span>}
              </td>
              <td className="nowrap">
                {f.etat === 'dossier_corbeille' ? (
                  <Link className="ev-link ev-ref" to="/admin/corbeille">
                    {f.dossier_numero}
                  </Link>
                ) : (
                  <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`}>
                    {f.dossier_numero}
                  </Link>
                )}
                <span className="fa-sub">{f.client_nom}</span>
              </td>
              <td className="nowrap">{ETAT_LABELS[f.etat]}</td>
              <td className="ev-cell-num">{formatTaille(f.taille)}</td>
              {avecTailleDisque && <td className="ev-cell-num">{formatTaille(f.taille_disque)}</td>}
              <td className="ev-ref nowrap">{formatDateHeure(f.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OngletControle() {
  const r = useIntegrite();
  const d = r.data;

  return (
    <div className="stack">
      <div className="row-between">
        <p className="ev-muted" style={{ margin: 0, maxWidth: '72ch' }}>
          Compare les fichiers enregistrés aux fichiers réellement présents dans le stockage du serveur. Utile après l’import de l’ancienne plateforme ou une
          restauration de sauvegarde.
        </p>
        <Button size="sm" icon={<RefreshCw />} busy={r.isFetching} onClick={() => void r.refetch()}>
          Relancer le contrôle
        </Button>
      </div>

      {r.isError ? (
        <Alert tone="error">Le contrôle n’a pas pu être fait : {messageErreur(r.error)}</Alert>
      ) : r.isLoading || !d ? (
        <LoadingRows rows={4} />
      ) : (
        <>
          <p className="fa-totaux">
            Contrôle fait le <span className="ev-ref">{formatDateHeure(d.verifie_at)}</span>{' '}
            {d.duree_ms < 1000 ? 'en moins d’une seconde' : `en ${formatDecimal(d.duree_ms / 1000, 1)} s`}.
          </p>
          <div className="ev-kpis fa-kpis">
            <Kpi label="Fichiers enregistrés" value={formatEntier(d.fichiers.nb)} meta={`${formatTaille(d.fichiers.taille)} déclarés`} />
            <Kpi
              label="Absents du disque"
              value={formatEntier(d.manquants.nb)}
              meta={d.manquants.nb ? `${formatTaille(d.manquants.taille_declaree)} à retrouver` : 'Aucun fichier manquant'}
              alert={d.manquants.nb > 0}
            />
            <Kpi label="Place occupée" value={formatTaille(d.presents.taille)} meta={`${pluriel(d.presents.nb, 'fichier présent', 'fichiers présents')}`} />
            <Kpi
              label="Espace libre"
              value={d.espace ? formatTaille(d.espace.libre_octets) : '—'}
              meta={d.espace ? `sur ${formatTaille(d.espace.total_octets)}` : 'Indisponible sur ce serveur'}
              alert={!!d.espace && d.espace.libre_octets < d.espace.total_octets * 0.1}
            />
          </div>

          <Card title="Répartition" flush>
            <div className="ev-table-wrap" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
              <table className="ev-table">
                <thead>
                  <tr>
                    <th scope="col">Fichiers</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Nombre
                    </th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Taille déclarée
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Dans les dossiers actifs</td>
                    <td className="ev-cell-num">{formatEntier(d.repartition.actifs.nb)}</td>
                    <td className="ev-cell-num">{formatTaille(d.repartition.actifs.taille)}</td>
                  </tr>
                  <tr>
                    <td>À la corbeille des fichiers</td>
                    <td className="ev-cell-num">{formatEntier(d.repartition.corbeille.nb)}</td>
                    <td className="ev-cell-num">{formatTaille(d.repartition.corbeille.taille)}</td>
                  </tr>
                  <tr>
                    <td>Dans des dossiers à la corbeille</td>
                    <td className="ev-cell-num">{formatEntier(d.repartition.dossiers_corbeille.nb)}</td>
                    <td className="ev-cell-num">{formatTaille(d.repartition.dossiers_corbeille.taille)}</td>
                  </tr>
                  <tr>
                    <td>
                      Sur le disque sans fiche correspondante
                      <span className="fa-sub">Envois interrompus ou restes d’import, sous « dossiers/ »</span>
                    </td>
                    <td className="ev-cell-num">{formatEntier(d.orphelins.nb)}</td>
                    <td className="ev-cell-num">{formatTaille(d.orphelins.taille)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {d.manquants.nb === 0 ? (
            <Alert tone="success">Tous les fichiers enregistrés sont présents sur le disque.</Alert>
          ) : (
            <section className="stack-sm" aria-labelledby="fa-manquants">
              <h2 className="ev-h-heading" id="fa-manquants">
                {pluriel(d.manquants.nb, 'fichier absent', 'fichiers absents')} du disque
              </h2>
              <p className="ev-muted" style={{ margin: 0 }}>
                Ces fichiers sont enregistrés mais leur contenu est introuvable : l’aperçu et le téléchargement échouent. Recopiez-les à l’emplacement indiqué
                dans le dossier de stockage, ou demandez au client de les renvoyer.
                {d.manquants.items.length < d.manquants.nb && ` Seuls les ${d.manquants.items.length} plus récents sont listés.`}
              </p>
              <TableControle items={d.manquants.items} />
            </section>
          )}

          {d.taille_differente.nb > 0 && (
            <section className="stack-sm" aria-labelledby="fa-tailles">
              <h2 className="ev-h-heading" id="fa-tailles">
                {pluriel(d.taille_differente.nb, 'fichier', 'fichiers')} de taille différente
              </h2>
              <p className="ev-muted" style={{ margin: 0 }}>
                Le fichier présent sur le disque n’a pas la taille enregistrée lors de l’envoi : copie incomplète ou fichier remplacé. Vérifiez-le avant
                impression.
                {d.taille_differente.items.length < d.taille_differente.nb && ` Seuls les ${d.taille_differente.items.length} plus récents sont listés.`}
              </p>
              <TableControle items={d.taille_differente.items} avecTailleDisque />
            </section>
          )}
        </>
      )}
    </div>
  );
}
