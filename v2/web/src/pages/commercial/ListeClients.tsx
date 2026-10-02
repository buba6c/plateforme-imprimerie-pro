import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, UserRound } from 'lucide-react';
import { formatDate, formatEntier, formatFCFA } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Card, EmptyState, LoadingRows, PageHeader, Pagination, useToast } from '../../ui';
import { ClientDialog } from '../../features/commercial/ClientDialog';
import { pluriel } from '../../features/commercial/format';
import { useDebounced, useListeClients } from '../../features/commercial/hooks';
import '../../features/commercial/commercial.css';

const LIMIT = 50;

export default function ListeClients() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [saisie, setSaisie] = useState(params.get('q') ?? '');
  const q = useDebounced(saisie.trim(), 300);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [creation, setCreation] = useState(false);

  const maj = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if ((params.get('q') ?? '') !== q) maj({ q: q || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const liste = useListeClients({ q: q || undefined, page, limit: LIMIT });
  const items = liste.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Coordonnées, commandes et sommes restant dues, du plus récent au plus ancien dossier."
        actions={
          <Button variant="primary" icon={<UserPlus />} onClick={() => setCreation(true)}>
            Nouveau client
          </Button>
        }
      />
      <div className="stack">
        <div className="ev-filterbar">
          <div className="ev-search" role="search">
            <Search aria-hidden="true" />
            <input className="ev-input" type="search" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Nom, téléphone ou e-mail" aria-label="Rechercher un client" />
          </div>
          {liste.data && (
            <span className="ev-muted" style={{ fontSize: 13 }}>
              {pluriel(liste.data.total, 'client')}
            </span>
          )}
        </div>

        {liste.isError ? (
          <Alert tone="error">
            La liste des clients n'a pas pu être chargée : {messageErreur(liste.error)}{' '}
            <button className="cm-lien-bouton" onClick={() => void liste.refetch()}>
              Réessayer
            </button>
          </Alert>
        ) : liste.isLoading ? (
          <LoadingRows rows={8} />
        ) : items.length === 0 ? (
          <Card>
            {q ? (
              <EmptyState
                title="Aucun client ne correspond"
                icon={<Search aria-hidden="true" />}
                action={
                  <Button size="sm" onClick={() => setSaisie('')}>
                    Effacer la recherche
                  </Button>
                }
              >
                Aucune fiche pour « {q} ». Vérifiez l’orthographe ou cherchez par numéro de téléphone.
              </EmptyState>
            ) : (
              <EmptyState
                title="Aucun client pour l'instant"
                icon={<UserRound aria-hidden="true" />}
                action={
                  <Button size="sm" variant="primary" icon={<UserPlus />} onClick={() => setCreation(true)}>
                    Nouveau client
                  </Button>
                }
              >
                Les fiches se créent avec les dossiers et les devis, ou ici directement.
              </EmptyState>
            )}
          </Card>
        ) : (
          <>
            <div className="ev-table-wrap cm-large">
              <table className="ev-table ev-table--clickable">
                <thead>
                  <tr>
                    <th scope="col">Nom</th>
                    <th scope="col">Téléphone</th>
                    <th scope="col">E-mail</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Dossiers
                    </th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Total commandes
                    </th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Reste dû
                    </th>
                    <th scope="col">Dernier dossier</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                      <td style={{ maxWidth: 300 }}>
                        <Link className="ev-cell-main cm-lien-ref" to={`/clients/${c.id}`} onClick={(e) => e.stopPropagation()}>
                          {c.nom}
                        </Link>
                        {c.adresse && <span className="ev-cell-sub truncate">{c.adresse}</span>}
                      </td>
                      <td className="ev-ref nowrap">{c.telephone ?? '—'}</td>
                      <td className="truncate" style={{ maxWidth: 220 }}>
                        {c.email ?? '—'}
                      </td>
                      <td className="ev-cell-num">{formatEntier(c.nb_dossiers)}</td>
                      <td className="ev-cell-num">{formatFCFA(c.total_commandes)}</td>
                      <td className={`ev-cell-num${c.reste_du > 0 ? ' cm-danger' : ''}`}>{formatFCFA(c.reste_du)}</td>
                      <td className="ev-ref nowrap">{formatDate(c.dernier_dossier_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} total={liste.data?.total ?? 0} limit={LIMIT} onPage={(p) => maj({ page: p > 1 ? String(p) : null })} />
            </div>

            <div className="cm-etroit cm-cartes">
              {items.map((c) => (
                <Link key={c.id} to={`/clients/${c.id}`} className="ev-job ev-card--interactive cm-carte" aria-label={`Client ${c.nom}`}>
                  <div>
                    <p className="ev-job__client">{c.nom}</p>
                    <p className="ev-job__spec">{[c.telephone, c.email].filter(Boolean).join(' · ') || 'Sans téléphone ni e-mail'}</p>
                  </div>
                  <div className="ev-job__foot">
                    <span className="ev-muted" style={{ fontSize: 13 }}>
                      {pluriel(c.nb_dossiers, 'dossier')} · {formatFCFA(c.total_commandes)}
                    </span>
                    {c.reste_du > 0 ? <span className="cm-danger" style={{ fontSize: 13 }}>
                        Reste <span className="ev-num">{formatFCFA(c.reste_du)}</span>
                      </span> : <span className="ev-muted" style={{ fontSize: 13 }}>Rien à payer</span>}
                  </div>
                </Link>
              ))}
              <Pagination page={page} total={liste.data?.total ?? 0} limit={LIMIT} onPage={(p) => maj({ page: p > 1 ? String(p) : null })} />
            </div>
          </>
        )}
      </div>

      {creation && (
        <ClientDialog
          onClose={() => setCreation(false)}
          onSaved={(c) => {
            setCreation(false);
            toast.success('Client créé', c.nom);
            navigate(`/clients/${c.id}`);
          }}
        />
      )}
    </>
  );
}
