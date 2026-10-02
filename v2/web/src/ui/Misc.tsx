import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Inbox, XCircle } from 'lucide-react';
import { formatFCFA } from '@evocom/shared';

export function Card({ title, actions, children, footer, className, bodyClassName, flush }: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}) {
  return (
    <section className={['ev-card', className].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <header className="ev-card__head">
          {title && <h2 className="ev-card__title">{title}</h2>}
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={[flush ? '' : 'ev-card__body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
      {footer && <footer className="ev-card__foot">{footer}</footer>}
    </section>
  );
}

export function PageHeader({ title, subtitle, crumbs, actions }: { title: ReactNode; subtitle?: ReactNode; crumbs?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ev-page-head">
      <div className="stack-sm" style={{ gap: 4 }}>
        {crumbs && <nav className="ev-crumbs" aria-label="Fil d'Ariane">{crumbs}</nav>}
        <h1 className="ev-h-display">{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ev-empty">
      {icon ?? <Inbox aria-hidden="true" />}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: number | string }) {
  return <div className="ev-skeleton" style={{ height: h, width: w }} aria-hidden="true" />;
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} h={44} />
      ))}
    </div>
  );
}

const ALERT_ICON = { info: Info, warning: AlertTriangle, error: XCircle, success: CheckCircle2 };

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error' | 'success'; children: ReactNode }) {
  const Icon = ALERT_ICON[tone];
  return (
    <div className="ev-alert" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Kpi({ label, value, unit, meta, alert }: { label: string; value: ReactNode; unit?: string; meta?: ReactNode; alert?: boolean }) {
  return (
    <div className="ev-card ev-kpi">
      <span className="ev-kpi__label">{label}</span>
      <span className="ev-kpi__value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {meta && (
        <span className="ev-kpi__meta" data-tone={alert ? 'alert' : undefined}>
          {meta}
        </span>
      )}
    </div>
  );
}

export function Money({ value }: { value: number | null | undefined }) {
  return <span className="ev-num">{formatFCFA(value)}</span>;
}

export interface TabDef<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: TabDef<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ev-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" className="ev-tab" aria-selected={t.value === value} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && <span className="ev-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="row-between" style={{ padding: 'var(--space-3) var(--space-4)' }}>
      <span className="ev-muted" style={{ fontSize: 13 }}>
        Page {page} sur {pages} · {total} résultat{total > 1 ? 's' : ''}
      </span>
      <div className="row">
        <button className="ev-btn ev-btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Précédent
        </button>
        <button className="ev-btn ev-btn--sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Suivant
        </button>
      </div>
    </div>
  );
}
