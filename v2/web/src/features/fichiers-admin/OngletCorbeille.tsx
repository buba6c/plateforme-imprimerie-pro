// Corbeille des fichiers (administrateur) : fichiers retirés de leur dossier, restauration.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Search, Trash2 } from 'lucide-react';
import { formatDateHeure, formatEntier, formatTaille } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Card, EmptyState, LoadingRows, MachineChip, Pagination, useToast } from '../../ui';
import { extension } from '../fichiers/ListeFichiers';
import { useCorbeilleFichiers } from './hooks';
import type { FichierGlobal, FichierSupprime } from './types';

const LIMIT = 50;

function EtatDossier({ f }: { f: FichierSupprime }) {
  return f.dossier_supprime ? (
    <span
      className="ev-badge ev-pay"
      data-pay="refuse"
      title={f.dossier_deleted_at ? `Dossier supprimé le ${formatDateHeure(f.dossier_deleted_at)}` : undefined}
    >
      Dossier à la corbeille
    </span>
  ) : (
    <span className="ev-badge ev-pay" data-pay="paye">
      Dossier actif
    </span>
  );
}

function LienDossier({ f }: { f: FichierSupprime }) {
  // Un dossier à la corbeille ne s'ouvre pas : on renvoie vers la corbeille des dossiers.
  return f.dossier_supprime ? (
    <Link className="ev-link ev-ref" to="/admin/corbeille">
      {f.dossier_numero}
    </Link>
  ) : (
    <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`}>
      {f.dossier_numero}
    </Link>
  );
}

export function OngletCorbeille() {
  const qc = useQueryClient();
  const toast = useToast();
  const [saisie, setSaisie] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [enCours, setEnCours] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const liste = useCorbeilleFichiers({ q: q || undefined, page, limit: LIMIT });
  const items = liste.data?.items ?? [];
  const total = liste.data?.total ?? 0;

  const restaurer = useMutation({
    mutationFn: (f: FichierSupprime) => api.post<FichierGlobal>(`/gestion-fichiers/${f.id}/restaurer`),
    onMutate: (f) => setEnCours(f.id),
    onSettled: () => setEnCours(null),
    onSuccess: (_r, f) => {
      void qc.invalidateQueries({ queryKey: ['dossiers'] });
      void qc.invalidateQueries({ queryKey: ['dossier', f.dossier_id] });
      void qc.invalidateQueries({ queryKey: ['fichiers-integrite'] });
      toast.success('Fichier restauré', `« ${f.nom_original} » est de nouveau dans le dossier ${f.dossier_numero}.`);
    },
    onError: (e, f) => toast.error(`« ${f.nom_original} » n’a pas été restauré`, messageErreur(e)),
  });

  const bouton = (f: FichierSupprime) =>
    f.peut_restaurer ? (
      <Button size="sm" icon={<ArchiveRestore />} busy={enCours === f.id} disabled={enCours !== null && enCours !== f.id} onClick={() => restaurer.mutate(f)}>
        Restaurer
      </Button>
    ) : (
      <Link className="ev-btn ev-btn--sm ev-btn--ghost" to="/admin/corbeille" title="Restaurez d’abord le dossier, puis ce fichier">
        Restaurer le dossier d’abord
      </Link>
    );

  const pagination = <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />;

  return (
    <div className="stack">
      <p className="ev-muted" style={{ margin: 0 }}>
        Fichiers retirés d’un dossier. Un fichier restauré retrouve sa place dans son dossier, et l’opération est notée dans l’historique du dossier et dans le
        journal. Rien n’est effacé du disque.
      </p>
      <div className="fa-filtres" role="search" aria-label="Rechercher dans la corbeille des fichiers">
        <div className="ev-field ev-search" style={{ maxWidth: 420 }}>
          <Search aria-hidden="true" />
          <input
            className="ev-input"
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Fichier, numéro de dossier ou client"
            aria-label="Rechercher un fichier supprimé"
          />
        </div>
      </div>

      {liste.isError ? (
        <Alert tone="error">La corbeille des fichiers n’a pas pu être chargée : {messageErreur(liste.error)}</Alert>
      ) : liste.isLoading ? (
        <LoadingRows rows={4} />
      ) : items.length === 0 ? (
        <Card>
          {q ? (
            <EmptyState title="Aucun fichier supprimé ne correspond" icon={<Search aria-hidden="true" />}>
              Modifiez la recherche.
            </EmptyState>
          ) : (
            <EmptyState title="La corbeille des fichiers est vide" icon={<Trash2 aria-hidden="true" />}>
              Les fichiers supprimés depuis la fiche d’un dossier apparaissent ici et peuvent être restaurés.
            </EmptyState>
          )}
        </Card>
      ) : (
        <>
          <p className="fa-totaux">
            <strong className="ev-num">{formatEntier(total)}</strong> {total > 1 ? 'fichiers' : 'fichier'} ·{' '}
            <strong className="ev-num">{formatTaille(liste.data?.taille_totale ?? 0)}</strong>
          </p>
          <div className="ev-table-wrap fa-large">
            <table className="ev-table">
              <thead>
                <tr>
                  <th scope="col">Fichier</th>
                  <th scope="col">Dossier</th>
                  <th scope="col">Supprimé</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Taille
                  </th>
                  <th scope="col" className="ev-cell-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div className="fa-nom">
                        <span className="ev-file__type" aria-hidden="true">
                          {extension(f.nom_original)}
                        </span>
                        <span className="fa-nom__texte">
                          <span className="ev-cell-main truncate" style={{ maxWidth: 300 }} title={f.nom_original}>
                            {f.nom_original}
                          </span>
                          <span className="fa-sub">
                            envoyé le {formatDateHeure(f.created_at)} par {f.uploaded_by_nom ?? '—'}
                          </span>
                          {!f.present && (
                            <span className="ev-badge ev-pay" data-pay="partiel">
                              Absent du disque
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="stack-sm" style={{ gap: 4 }}>
                        <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          <LienDossier f={f} />
                          <MachineChip machine={f.machine} />
                        </span>
                        <span className="fa-sub">{f.client_nom}</span>
                        <span>
                          <EtatDossier f={f} />
                        </span>
                      </div>
                    </td>
                    <td className="nowrap">
                      <span className="ev-ref">{formatDateHeure(f.deleted_at)}</span>
                      <span className="fa-sub">par {f.deleted_by_nom ?? '—'}</span>
                    </td>
                    <td className="ev-cell-num">{formatTaille(f.taille)}</td>
                    <td className="ev-cell-actions">{bouton(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagination}
          </div>
          <div className="fa-etroit fa-cartes">
            {items.map((f) => (
              <article key={f.id} className="ev-card fa-carte">
                <div className="fa-carte__tete">
                  <span className="ev-file__type" aria-hidden="true">
                    {extension(f.nom_original)}
                  </span>
                  <span className="fa-nom__texte">
                    <span className="ev-cell-main" style={{ overflowWrap: 'anywhere' }}>
                      {f.nom_original}
                    </span>
                    <span className="fa-sub">
                      <span className="ev-num">{formatTaille(f.taille)}</span> · supprimé le <span className="ev-ref">{formatDateHeure(f.deleted_at)}</span> par{' '}
                      {f.deleted_by_nom ?? '—'}
                    </span>
                  </span>
                  <span />
                </div>
                <div className="fa-carte__ligne">
                  <LienDossier f={f} />
                  <MachineChip machine={f.machine} />
                  <EtatDossier f={f} />
                  {!f.present && (
                    <span className="ev-badge ev-pay" data-pay="partiel">
                      Absent du disque
                    </span>
                  )}
                </div>
                <div className="fa-carte__ligne">
                  <span style={{ color: 'var(--text)' }}>{f.client_nom}</span>
                </div>
                <div>{bouton(f)}</div>
              </article>
            ))}
            {pagination}
          </div>
        </>
      )}
    </div>
  );
}
