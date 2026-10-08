import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { formatDateHeure, formatRelatif, formatTaille } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Card, LoadingRows, PageHeader } from '../../ui';
import type { Sante as S } from '../../features/admin/types';
import { CarteEspaceDisque, CarteHistorique, CarteSauvegarderMaintenant } from '../../features/admin/SanteSauvegardes';
import '../../features/admin/admin.css';

const MAX_AGE_H = 26;
const CONSIGNE =
  'Sur le serveur, vérifiez la tâche planifiée /etc/cron.d/evocom-backup et le journal /var/log/evocom-backup.log, puis lancez le script v2/deploy/backup.sh à la main pour voir l’erreur.';

function Etat({ tone, children }: { tone: 'ok' | 'ko' | 'warn'; children: ReactNode }) {
  return (
    <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
      <span className="adm-dot" data-tone={tone} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

export default function Sante() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sante'], queryFn: () => api.get<S>('/sante'), refetchInterval: 60_000 });
  const actualiser = () => {
    void q.refetch();
    void qc.invalidateQueries({ queryKey: ['sauvegardes'] });
    void qc.invalidateQueries({ queryKey: ['stockage'] });
  };
  const s = q.data;

  const sauvegarde = s?.derniere_sauvegarde ?? null;
  const ageH = sauvegarde ? (Date.now() - new Date(sauvegarde.created_at).getTime()) / 3_600_000 : null;
  const sauvegardeKo = !!s && (!sauvegarde || !sauvegarde.ok || (ageH !== null && ageH > MAX_AGE_H));
  const horsServeur = !!sauvegarde?.message && /RCLONE_DEST/.test(sauvegarde.message);

  const libre = s?.stockage.libre_octets ?? null;
  const total = s?.stockage.total_octets ?? null;
  const partLibre = libre !== null && total ? libre / total : null;
  const GO = 1024 ** 3;
  const stockageTone: 'ok' | 'warn' | 'ko' =
    libre === null
      ? 'ko'
      : libre < 2 * GO || (partLibre !== null && partLibre < 0.03)
        ? 'ko'
        : libre < 10 * GO || (partLibre !== null && partLibre < 0.1)
          ? 'warn'
          : 'ok';

  const migrationsEnAttente = s?.migrations.en_attente ?? [];

  return (
    <>
      <PageHeader
        title="Sauvegardes et état"
        subtitle="Sauvegardes (automatique chaque nuit, ou à la demande), place sur le disque et état du serveur."
        actions={
          <Button icon={<RefreshCw />} onClick={actualiser} busy={q.isFetching}>
            Actualiser
          </Button>
        }
      />
      {q.isError ? (
        <Alert tone="error">L’état du serveur n’a pas pu être lu : {messageErreur(q.error)}</Alert>
      ) : q.isLoading || !s ? (
        <LoadingRows rows={4} />
      ) : (
        <>
          {sauvegardeKo && (
            <Alert tone="error">
              <strong>
                {!sauvegarde
                  ? 'Aucune sauvegarde n’a jamais été enregistrée.'
                  : !sauvegarde.ok
                    ? 'La dernière sauvegarde a échoué.'
                    : `La dernière sauvegarde date de plus de ${MAX_AGE_H} heures.`}
              </strong>{' '}
              {CONSIGNE}
            </Alert>
          )}
          {!s.base.ok && <Alert tone="error">{s.base.erreur ?? 'La base de données ne répond pas.'}</Alert>}
          {migrationsEnAttente.length > 0 && (
            <Alert tone="warning">
              {migrationsEnAttente.length}{' '}
              {migrationsEnAttente.length > 1 ? 'migrations de base de données en attente' : 'migration de base de données en attente'} : relancez le
              déploiement (v2/deploy/deploy.sh) pour les appliquer.
            </Alert>
          )}

          <div className="sante-grille">
            <div className="sante-sections">
              <CarteSauvegarderMaintenant />
              <CarteHistorique />
            </div>
            <CarteEspaceDisque />
          </div>

          <div className="adm-health">
            <Card title="Dernière sauvegarde">
              {sauvegarde ? (
                <dl className="kv">
                  <dt>État</dt>
                  <dd>
                    <Etat tone={sauvegardeKo ? 'ko' : 'ok'}>{sauvegarde.ok ? (sauvegardeKo ? 'Trop ancienne' : 'Réussie') : 'Échec'}</Etat>
                  </dd>
                  <dt>Date</dt>
                  <dd>
                    <span className="ev-ref">{formatDateHeure(sauvegarde.created_at)}</span>
                    <span className="adm-sub">{formatRelatif(sauvegarde.created_at)}</span>
                  </dd>
                  <dt>Taille</dt>
                  <dd className="ev-num">{sauvegarde.taille ? formatTaille(sauvegarde.taille) : '—'}</dd>
                  {sauvegarde.fichier && (
                    <>
                      <dt>Fichier</dt>
                      <dd className="ev-ref" style={{ fontSize: 12 }}>
                        {sauvegarde.fichier}
                      </dd>
                    </>
                  )}
                  {sauvegarde.message && (
                    <>
                      <dt>Message</dt>
                      <dd>{sauvegarde.message}</dd>
                    </>
                  )}
                </dl>
              ) : (
                <p className="ev-muted" style={{ margin: 0 }}>
                  Aucune sauvegarde enregistrée.
                </p>
              )}
              {horsServeur && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <Alert tone="warning">
                    Les sauvegardes restent sur le même disque que l’application : une panne du serveur les emporterait. Configurez une copie externe
                    (RCLONE_DEST dans v2/api/.env).
                  </Alert>
                </div>
              )}
            </Card>

            <Card title="Stockage des fichiers">
              <div className="stack">
                <dl className="kv">
                  <dt>Espace libre</dt>
                  <dd>
                    <Etat tone={stockageTone}>
                      <span className="ev-num">{formatTaille(libre)}</span>
                      {total ? <span className="ev-muted"> sur {formatTaille(total)}</span> : null}
                    </Etat>
                  </dd>
                  <dt>Dossier</dt>
                  <dd className="ev-ref" style={{ fontSize: 12 }}>
                    {s.stockage.chemin}
                  </dd>
                </dl>
                {partLibre !== null && (
                  <div className="stack-sm" style={{ gap: 4 }}>
                    <div
                      className="adm-meter"
                      data-tone={stockageTone === 'ok' ? undefined : stockageTone}
                      role="meter"
                      aria-label="Espace disque utilisé"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round((1 - partLibre) * 100)}
                    >
                      <span style={{ width: `${Math.round((1 - partLibre) * 100)}%` }} />
                    </div>
                    <span className="ev-help">{Math.round((1 - partLibre) * 100)} % utilisé</span>
                  </div>
                )}
                {s.stockage.erreur && <Alert tone="error">{s.stockage.erreur}</Alert>}
                {stockageTone !== 'ok' && !s.stockage.erreur && (
                  <Alert tone={stockageTone === 'ko' ? 'error' : 'warning'}>
                    Le disque se remplit : libérez de l’espace ou agrandissez le volume avant qu’un envoi de fichier échoue.
                  </Alert>
                )}
              </div>
            </Card>

            <Card title="Application">
              <dl className="kv">
                <dt>Version</dt>
                <dd className="ev-ref">{s.version}</dd>
                <dt>Base de données</dt>
                <dd>
                  <Etat tone={s.base.ok ? 'ok' : 'ko'}>
                    {s.base.ok ? 'Joignable' : 'Injoignable'}
                    {s.base.ok && s.base.latence_ms !== undefined && <span className="ev-muted"> · {s.base.latence_ms} ms</span>}
                  </Etat>
                </dd>
                <dt>Migrations</dt>
                <dd>
                  {s.migrations.a_jour === null ? (
                    <Etat tone="warn">{s.migrations.erreur ?? 'État inconnu'}</Etat>
                  ) : s.migrations.a_jour ? (
                    <Etat tone="ok">À jour</Etat>
                  ) : (
                    <Etat tone="warn">
                      {migrationsEnAttente.length} en attente
                      <span className="adm-sub ev-ref">{migrationsEnAttente.join(', ')}</span>
                    </Etat>
                  )}
                </dd>
                <dt>Vérifié</dt>
                <dd className="ev-ref">{formatDateHeure(new Date(q.dataUpdatedAt))}</dd>
              </dl>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
