import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import { formatDateHeure, formatFCFA } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import type { DossierDetail } from '../../lib/types';
import { Alert, Button, EmptyState, LoadingRows, MachineChip, PageHeader, StatusBadge, useToast } from '../../ui';
import type { DossierSupprime } from '../../features/admin/types';
import '../../features/admin/admin.css';

export default function Corbeille() {
  const qc = useQueryClient();
  const toast = useToast();
  const [enCours, setEnCours] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['dossiers', 'corbeille'], queryFn: () => api.get<DossierSupprime[]>('/corbeille') });

  const restaurer = useMutation({
    mutationFn: (d: DossierSupprime) => api.post<DossierDetail>(`/dossiers/${d.id}/restaurer`),
    onMutate: (d) => setEnCours(d.id),
    onSettled: () => setEnCours(null),
    onSuccess: (r, d) => {
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.setQueryData(['dossier', r.id], r);
      toast.success('Dossier restauré', `${d.numero} · ${d.client_nom} est de nouveau dans les listes, au statut « ${r.statut_label} ».`);
    },
    onError: (e, d) => toast.error(`${d.numero} n’a pas été restauré`, messageErreur(e)),
  });

  return (
    <>
      <PageHeader
        title="Corbeille"
        subtitle="Dossiers supprimés. Un dossier restauré retrouve sa place dans les listes avec son statut, ses fichiers et ses paiements."
      />
      {q.isError ? (
        <Alert tone="error">La corbeille n’a pas pu être chargée : {messageErreur(q.error)}</Alert>
      ) : q.isLoading ? (
        <LoadingRows rows={4} />
      ) : !q.data || q.data.length === 0 ? (
        <div className="ev-card">
          <EmptyState title="La corbeille est vide" icon={<Trash2 aria-hidden="true" />}>
            Les dossiers supprimés depuis leur fiche apparaissent ici et peuvent être restaurés.
          </EmptyState>
        </div>
      ) : (
        <div className="ev-table-wrap">
          <table className="ev-table adm-dense">
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Statut</th>
                <th className="adm-num-th">Montant</th>
                <th>Supprimé</th>
                <th>Motif</th>
                <th className="ev-cell-actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <span className="ev-ref">{d.numero}</span>
                      <MachineChip machine={d.machine} />
                    </div>
                    <span className="adm-sub">{d.client_nom}</span>
                  </td>
                  <td>
                    <StatusBadge statut={d.statut} />
                  </td>
                  <td className="ev-cell-num">
                    {formatFCFA(d.montant)}
                    {d.nb_paiements > 0 && (
                      <span className="adm-sub">
                        {d.nb_paiements} {d.nb_paiements > 1 ? 'paiements' : 'paiement'}
                      </span>
                    )}
                  </td>
                  <td className="nowrap">
                    <span className="ev-ref">{formatDateHeure(d.deleted_at)}</span>
                    <span className="adm-sub">par {d.deleted_by_nom ?? '—'}</span>
                  </td>
                  <td style={{ maxWidth: 320 }}>{d.motif ?? <span className="ev-muted">Sans motif</span>}</td>
                  <td className="ev-cell-actions">
                    <Button size="sm" icon={<ArchiveRestore />} busy={enCours === d.id} onClick={() => restaurer.mutate(d)}>
                      Restaurer
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {restaurer.isSuccess && restaurer.data && (
        <p className="adm-explain">
          Dernier dossier restauré :{' '}
          <Link className="ev-link" to={`/dossiers/${restaurer.data.id}`}>
            ouvrir {restaurer.data.numero}
          </Link>
        </p>
      )}
    </>
  );
}
