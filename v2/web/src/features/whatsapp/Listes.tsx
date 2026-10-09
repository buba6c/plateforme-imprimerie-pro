import { useState } from 'react';
import { Inbox, ShieldOff, Trash2 } from 'lucide-react';
import { formatDateHeure } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import { Alert, Button, ConfirmDialog, EmptyState, LoadingRows, Pagination, useToast } from '../../ui';
import { useEntrants, useOptOut, useRetirerOptOut } from './api';

export function ListeStop() {
  const q = useOptOut();
  const retirer = useRetirerOptOut();
  const toast = useToast();
  const [cible, setCible] = useState<string | null>(null);
  if (q.isLoading) return <LoadingRows rows={3} />;
  if (q.isError || !q.data) return <Alert tone="error">La liste n’a pas pu être lue : {messageErreur(q.error)}</Alert>;
  return (
    <div className="stack">
      <p className="adm-explain">
        Ces numéros ne reçoivent plus aucun message : le client a répondu STOP, ou vous l’avez demandé. Retirez un numéro seulement si le client le demande
        lui-même.
      </p>
      {q.data.length === 0 ? (
        <div className="ev-card">
          <EmptyState title="Aucun numéro en liste STOP" icon={<ShieldOff aria-hidden="true" />}>
            Un client qui répond « STOP » au numéro dédié est ajouté ici automatiquement, avec un accusé de réception.
          </EmptyState>
        </div>
      ) : (
        <div className="ev-table-wrap">
          <table className="ev-table">
            <thead>
              <tr>
                <th>Téléphone</th>
                <th>Depuis</th>
                <th>Motif</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((o) => (
                <tr key={o.telephone}>
                  <td className="nowrap">
                    <span className="ev-ref">{o.telephone}</span>
                  </td>
                  <td className="nowrap">
                    <span className="ev-ref">{formatDateHeure(o.created_at)}</span>
                  </td>
                  <td>{o.motif ?? <span className="ev-muted">—</span>}</td>
                  <td>
                    <Button size="sm" icon={<Trash2 />} onClick={() => setCible(o.telephone)}>
                      Retirer de la liste
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={!!cible}
        onClose={() => setCible(null)}
        title="Retirer ce numéro de la liste STOP ?"
        description={`Le numéro ${cible ?? ''} recevra de nouveau les messages automatiques. Faites-le seulement si le client l’a demandé.`}
        confirmLabel="Retirer"
        danger
        busy={retirer.isPending}
        onConfirm={() =>
          cible &&
          retirer.mutate(cible, {
            onSuccess: () => {
              setCible(null);
              toast.success('Numéro retiré de la liste STOP');
            },
            onError: (e) => toast.error('Retrait impossible', messageErreur(e)),
          })
        }
      />
    </div>
  );
}

export function Entrants() {
  const [page, setPage] = useState(1);
  const q = useEntrants(page);
  if (q.isLoading) return <LoadingRows rows={3} />;
  if (q.isError || !q.data) return <Alert tone="error">Les réponses n’ont pas pu être lues : {messageErreur(q.error)}</Alert>;
  return (
    <div className="stack">
      <p className="adm-explain">
        Ce que les clients écrivent au numéro dédié (texte seulement). Pour répondre, utilisez WhatsApp sur le téléphone dédié : cette application n’envoie que
        les messages automatiques.
      </p>
      {q.data.items.length === 0 ? (
        <div className="ev-card">
          <EmptyState title="Aucune réponse reçue" icon={<Inbox aria-hidden="true" />}>
            Les messages reçus sur le numéro dédié apparaîtront ici, les plus récents en premier.
          </EmptyState>
        </div>
      ) : (
        <div className="ev-table-wrap" style={{ opacity: q.isFetching ? 0.6 : 1 }}>
          <table className="ev-table">
            <thead>
              <tr>
                <th>Reçu le</th>
                <th>Téléphone</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((e) => (
                <tr key={e.id} style={{ verticalAlign: 'top' }}>
                  <td className="nowrap">
                    <span className="ev-ref">{formatDateHeure(e.recu_at)}</span>
                  </td>
                  <td className="nowrap">
                    <span className="ev-ref">{e.telephone}</span>
                  </td>
                  <td>
                    <p className="wa-texte">{e.texte}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={q.data.total} limit={q.data.limit} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
