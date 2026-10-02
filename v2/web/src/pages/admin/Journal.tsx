import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, X } from 'lucide-react';
import { formatDateHeure, formatEntier } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, EmptyState, LoadingRows, PageHeader, Pagination } from '../../ui';
import { useTarifs, useUsers } from '../../features/admin/hooks';
import { ACTION_LABELS, CIBLE_LABELS, libelleAction, resumerDonnees } from '../../features/admin/journal';
import type { EntreeJournal } from '../../features/admin/types';
import '../../features/admin/admin.css';

const LIMIT = 50;

export default function Journal() {
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [userId, action, from, to]);

  const users = useUsers();
  const tarifs = useTarifs();
  const datesInversees = !!from && !!to && from > to;

  const q = useQuery({
    queryKey: ['journal', userId, action, from, to, page],
    queryFn: () => api.get<{ items: EntreeJournal[]; total: number }>('/journal', { user_id: userId, action, from, to, page, limit: LIMIT }),
    placeholderData: (prev) => prev,
    enabled: !datesInversees,
  });

  const nomsUsers = useMemo(() => new Map((users.data ?? []).map((u) => [String(u.id), u.nom])), [users.data]);
  const nomsTarifs = useMemo(() => new Map((tarifs.data ?? []).map((t) => [String(t.id), t.libelle])), [tarifs.data]);
  const filtre = !!(userId || action || from || to);

  function cible(e: EntreeJournal): ReactNode {
    const type = e.cible ? (CIBLE_LABELS[e.cible] ?? e.cible) : '—';
    const d = (e.data && typeof e.data === 'object' ? e.data : {}) as Record<string, unknown>;
    const id = e.cible_id;
    if (e.cible === 'user' && id)
      return (
        <>
          {type} · {nomsUsers.get(id) ?? `n° ${id}`}
        </>
      );
    if (e.cible === 'tarif' && id)
      return (
        <>
          {type} · {nomsTarifs.get(id) ?? `n° ${id}`}
        </>
      );
    if (e.cible === 'paiement' && typeof d.dossier_id === 'number') {
      return (
        <>
          {type} ·{' '}
          <Link className={typeof d.numero === 'string' ? 'ev-link ev-ref' : 'ev-link'} to={`/dossiers/${d.dossier_id}`}>
            {typeof d.numero === 'string' ? d.numero : 'ouvrir le dossier'}
          </Link>
        </>
      );
    }
    if (e.cible === 'facture' && id) {
      return (
        <>
          {type} ·{' '}
          <Link className="ev-link ev-ref" to={`/factures/${id}`}>
            {typeof d.numero === 'string' ? d.numero : `n° ${id}`}
          </Link>
        </>
      );
    }
    if (e.cible === 'client' && id) {
      const source = d.source as { id?: unknown; nom?: unknown } | undefined;
      const nom = source && String(source.id) === id && typeof source.nom === 'string' ? source.nom : typeof d.nom === 'string' ? d.nom : null;
      return (
        <>
          {type} ·{' '}
          <Link className="ev-link" to={`/clients/${id}`}>
            {nom ?? `fiche n° ${id}`}
          </Link>
        </>
      );
    }
    if (e.cible === 'dossier' && id) {
      return (
        <>
          {type} ·{' '}
          <Link className="ev-link ev-ref" to={`/dossiers/${id}`}>
            {typeof d.numero === 'string' ? d.numero : `n° ${id}`}
          </Link>
        </>
      );
    }
    return id ? `${type} · n° ${id}` : type;
  }

  return (
    <>
      <PageHeader title="Journal" subtitle="Actions sensibles : comptes, tarifs, paramètres, paiements et factures. Les plus récentes en premier." />

      <div className="ev-filterbar" role="search" aria-label="Filtrer le journal">
        <select className="ev-select" aria-label="Utilisateur" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Tous les utilisateurs</option>
          {(users.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.nom}
            </option>
          ))}
        </select>
        <select className="ev-select" aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="row ev-muted" style={{ fontSize: 13, gap: 6 }}>
          Du
          <input className="ev-input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={{ minWidth: 150 }} />
        </label>
        <label className="row ev-muted" style={{ fontSize: 13, gap: 6 }}>
          au
          <input className="ev-input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={{ minWidth: 150 }} />
        </label>
        {filtre && (
          <Button
            size="sm"
            variant="ghost"
            icon={<X />}
            onClick={() => {
              setUserId('');
              setAction('');
              setFrom('');
              setTo('');
            }}
          >
            Effacer les filtres
          </Button>
        )}
        {q.data && (
          <span className="ev-muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
            {formatEntier(q.data.total)} {q.data.total > 1 ? 'entrées' : 'entrée'}
          </span>
        )}
      </div>

      {datesInversees ? (
        <Alert tone="warning">La date de début est postérieure à la date de fin : inversez-les.</Alert>
      ) : q.isError ? (
        <Alert tone="error">Le journal n’a pas pu être chargé : {messageErreur(q.error)}</Alert>
      ) : q.isLoading ? (
        <LoadingRows rows={8} />
      ) : !q.data || q.data.items.length === 0 ? (
        <div className="ev-card">
          <EmptyState title={filtre ? 'Aucune entrée pour ces filtres' : 'Le journal est vide'} icon={<ScrollText aria-hidden="true" />}>
            {filtre
              ? 'Élargissez la période ou retirez un filtre.'
              : 'Les créations de comptes, changements de tarifs ou de paramètres et validations de paiements y seront tracés.'}
          </EmptyState>
        </div>
      ) : (
        <div className="ev-table-wrap" style={{ opacity: q.isFetching ? 0.6 : 1 }}>
          <table className="ev-table adm-dense">
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Cible</th>
                <th>Détails</th>
                <th>Adresse IP</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((e) => {
                const kv = resumerDonnees(e.data);
                return (
                  <tr key={e.id} style={{ verticalAlign: 'top' }}>
                    <td className="nowrap">
                      <span className="ev-ref">{formatDateHeure(e.created_at)}</span>
                    </td>
                    <td className="nowrap">{e.user_nom ?? <span className="ev-muted">Système</span>}</td>
                    <td className="nowrap ev-cell-main">{libelleAction(e.action)}</td>
                    <td className="nowrap">{cible(e)}</td>
                    <td>
                      {kv.length ? (
                        <div className="adm-kvs">
                          {kv.map((p, i) => (
                            <span key={i}>
                              {p.cle} : <b>{p.valeur}</b>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="ev-muted">—</span>
                      )}
                    </td>
                    <td className="nowrap">
                      <span className="ev-ref ev-muted">{e.ip ?? '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={page} total={q.data.total} limit={LIMIT} onPage={setPage} />
        </div>
      )}
    </>
  );
}
