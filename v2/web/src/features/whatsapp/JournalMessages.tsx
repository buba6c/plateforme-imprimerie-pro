import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, MessageCircle, RefreshCw, Search, X } from 'lucide-react';
import { formatDateHeure } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Dialog, EmptyState, LoadingRows, Pagination, useToast } from '../../ui';
import { useAnnuler, useMessagesWhatsApp, useReessayer } from './api';
import { STATUT_LABELS, type MessageWhatsApp, type StatutMessage } from './types';

const STATUTS: StatutMessage[] = ['en_attente', 'envoye', 'echec', 'annule', 'ignore'];
const LIMIT = 50;

function BadgeStatut({ statut }: { statut: StatutMessage }) {
  return (
    <span className="wa-statut" data-statut={statut}>
      {STATUT_LABELS[statut]}
    </span>
  );
}

export function JournalMessages() {
  const [statut, setStatut] = useState<StatutMessage | ''>('');
  const [q, setQ] = useState('');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const [lecture, setLecture] = useState<MessageWhatsApp | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setRecherche(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [statut, recherche]);

  const liste = useMessagesWhatsApp({ statut, q: recherche, page });
  const reessayer = useReessayer();
  const annuler = useAnnuler();
  const toast = useToast();
  const filtre = !!(statut || recherche);
  const total = liste.data ? Object.values(liste.data.compteurs).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="stack">
      <div className="ev-filterbar" role="search" aria-label="Filtrer les messages">
        <div className="ev-search">
          <Search aria-hidden="true" />
          <input className="ev-input" type="search" placeholder="Numéro de commande, client ou téléphone" aria-label="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {filtre && (
          <Button
            size="sm"
            variant="ghost"
            icon={<X />}
            onClick={() => {
              setQ('');
              setStatut('');
            }}
          >
            Effacer
          </Button>
        )}
      </div>
      <div className="wa-filtres-statut" role="group" aria-label="Filtrer par statut">
        <button type="button" className="wa-chip" aria-pressed={statut === ''} onClick={() => setStatut('')}>
          Tous {liste.data && <span className="ev-count">{total}</span>}
        </button>
        {STATUTS.map((s) => (
          <button key={s} type="button" className="wa-chip" aria-pressed={statut === s} onClick={() => setStatut(s)}>
            {STATUT_LABELS[s]} {liste.data && <span className="ev-count">{liste.data.compteurs[s]}</span>}
          </button>
        ))}
      </div>

      {liste.isError ? (
        <Alert tone="error">Le journal n’a pas pu être chargé : {messageErreur(liste.error)}</Alert>
      ) : liste.isLoading ? (
        <LoadingRows rows={6} />
      ) : !liste.data || liste.data.items.length === 0 ? (
        <div className="ev-card">
          <EmptyState title={filtre ? 'Aucun message pour ces filtres' : 'Aucun message pour l’instant'} icon={<MessageCircle aria-hidden="true" />}>
            {filtre
              ? 'Changez de statut ou retirez la recherche.'
              : 'Les messages apparaîtront ici dès qu’une commande sera marquée imprimée, programmée ou livrée, ou après un envoi de test.'}
          </EmptyState>
        </div>
      ) : (
        <div className="ev-table-wrap" style={{ opacity: liste.isFetching ? 0.6 : 1 }}>
          <table className="ev-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Commande</th>
                <th>Événement</th>
                <th>Téléphone</th>
                <th>Statut</th>
                <th>Détail</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {liste.data.items.map((m) => (
                <tr key={m.id} style={{ verticalAlign: 'top' }}>
                  <td className="nowrap">
                    <span className="ev-ref">{formatDateHeure(m.envoye_at ?? m.created_at)}</span>
                    {m.statut === 'envoye' && <small className="ev-muted" style={{ display: 'block', fontSize: 12 }}>envoyé</small>}
                  </td>
                  <td>
                    <div className="wa-cell-client">
                      {m.dossier_id ? (
                        <Link className="ev-link ev-ref" to={`/dossiers/${m.dossier_id}`}>
                          {m.numero ?? `n° ${m.dossier_id}`}
                        </Link>
                      ) : (
                        <span className="ev-muted">Test</span>
                      )}
                      {m.client_nom && <small>{m.client_nom}</small>}
                    </div>
                  </td>
                  <td className="nowrap">{m.evenement_label}</td>
                  <td className="nowrap">
                    <span className="ev-ref">{m.telephone ?? '—'}</span>
                  </td>
                  <td className="nowrap">
                    <BadgeStatut statut={m.statut} />
                    {m.tentatives > 1 && (
                      <small className="ev-muted" style={{ display: 'block', fontSize: 12 }}>
                        {m.tentatives} tentatives
                      </small>
                    )}
                  </td>
                  <td>
                    {m.motif ? <span className="wa-motif">{m.motif}</span> : <span className="ev-muted">—</span>}
                  </td>
                  <td>
                    <div className="wa-actions">
                      <Button size="sm" variant="ghost" onClick={() => setLecture(m)}>
                        Lire
                      </Button>
                      {(m.statut === 'echec' || m.statut === 'annule' || m.statut === 'ignore') && (
                        <Button
                          size="sm"
                          icon={<RefreshCw />}
                          busy={reessayer.isPending && reessayer.variables === m.id}
                          onClick={() =>
                            reessayer.mutate(m.id, {
                              onSuccess: () => toast.success('Message remis en file'),
                              onError: (e) => toast.error('Impossible de réessayer', messageErreur(e)),
                            })
                          }
                        >
                          Réessayer
                        </Button>
                      )}
                      {m.statut === 'en_attente' && (
                        <Button
                          size="sm"
                          icon={<Ban />}
                          busy={annuler.isPending && annuler.variables === m.id}
                          onClick={() =>
                            annuler.mutate(m.id, {
                              onSuccess: () => toast.success('Message annulé'),
                              onError: (e) => toast.error('Annulation impossible', messageErreur(e)),
                            })
                          }
                        >
                          Annuler
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={liste.data.total} limit={LIMIT} onPage={setPage} />
        </div>
      )}

      <Dialog
        open={!!lecture}
        onClose={() => setLecture(null)}
        title={lecture ? `${lecture.evenement_label}${lecture.numero ? ` · ${lecture.numero}` : ''}` : ''}
        description={lecture ? `Vers ${lecture.telephone ?? '—'} · ${STATUT_LABELS[lecture.statut]}${lecture.envoye_at ? ` le ${formatDateHeure(lecture.envoye_at)}` : ''}` : undefined}
        footer={<Button onClick={() => setLecture(null)}>Fermer</Button>}
      >
        {lecture && (
          <div className="stack">
            <div className="wa-bulle">{lecture.texte}</div>
            {lecture.motif && <Alert tone={lecture.statut === 'echec' ? 'error' : 'info'}>{lecture.motif}</Alert>}
          </div>
        )}
      </Dialog>
    </div>
  );
}
