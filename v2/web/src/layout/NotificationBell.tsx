import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { formatRelatif } from '@evocom/shared';
import { api } from '../lib/api';
import { onNotification } from '../lib/realtime';
import type { Notification } from '../lib/types';
import { useToast } from '../ui';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ items: Notification[]; non_lues: number }>('/notifications'),
    refetchInterval: 120_000,
    retry: false,
  });
  const lire = useMutation({
    mutationFn: (ids?: number[]) => api.post('/notifications/lues', ids ? { ids } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(
    () =>
      onNotification((n) => {
        toast.info(n.titre, n.message ?? undefined);
      }),
    [toast],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const nonLues = q.data?.non_lues ?? 0;
  return (
    <div className="bell" ref={box} style={{ position: 'relative' }}>
      <button className="ev-icon-btn" aria-label={`Notifications${nonLues ? ` (${nonLues} non lues)` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell />
        {nonLues > 0 && <span className="bell__dot">{nonLues > 99 ? '99+' : nonLues}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover__head">
            <strong>Notifications</strong>
            {nonLues > 0 && (
              <button className="ev-btn ev-btn--ghost ev-btn--sm" onClick={() => lire.mutate(undefined)}>
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="popover__list">
            {q.data?.items.length ? (
              q.data.items.map((n) => (
                <button
                  key={n.id}
                  className="notif"
                  data-unread={!n.lu_at}
                  onClick={() => {
                    if (!n.lu_at) lire.mutate([n.id]);
                    setOpen(false);
                    if (n.dossier_id) navigate(`/dossiers/${n.dossier_id}`);
                  }}
                >
                  <span className="notif__title">{n.titre}</span>
                  {n.message && <span style={{ fontSize: 13 }}>{n.message}</span>}
                  <span className="notif__meta">{formatRelatif(n.created_at)}</span>
                </button>
              ))
            ) : (
              <div className="ev-empty" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                <strong>Aucune notification</strong>
                <p>Les dossiers qui vous concernent apparaîtront ici.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
