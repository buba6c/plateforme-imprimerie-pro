// Graphiques de l'administration (recharts). Couleurs lues dans les variables de la charte :
// elles suivent le thème clair ou sombre sans couleur écrite en dur.
//   Montant commandé : --accent   ·   Encaissé : --st-ship-solid
// Couple validé (scripts/validate_palette.js) : séparation daltonisme ΔE 19,2 (clair) / 13,4 (sombre).
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatEntier, formatFCFA } from '@evocom/shared';
import { libelleAxe, libelleLong } from './dates';
import type { Pas, PointEvolution } from './types';

const VARS = ['--accent', '--st-ship-solid', '--line', '--text-muted', '--text', '--surface', '--font-mono', '--font-sans'] as const;
type Var = (typeof VARS)[number];

function lire(): Record<Var, string> {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(VARS.map((v) => [v, cs.getPropertyValue(v).trim()])) as Record<Var, string>;
}

/** Valeurs résolues des variables de couleur, recalculées quand le thème change. */
export function useChartColors() {
  const [v, setV] = useState(lire);
  useEffect(() => {
    const up = () => setV(lire());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', up);
    const mo = new MutationObserver(up);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', up);
      mo.disconnect();
    };
  }, []);
  return {
    commande: v['--accent'],
    encaisse: v['--st-ship-solid'],
    grid: v['--line'],
    muted: v['--text-muted'],
    text: v['--text'],
    surface: v['--surface'],
    mono: v['--font-mono'],
    sans: v['--font-sans'],
  };
}

/** 1 250 000 -> « 1,25 M » ; 45 000 -> « 45 k » (graduations). */
export function montantCourt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M`;
  if (a >= 1_000) return `${(n / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  return formatEntier(n);
}

export function Legende({ items }: { items: { label: string; color: string; kind?: 'line' | 'rect' }[] }) {
  return (
    <ul className="adm-legend" aria-label="Légende">
      {items.map((i) => (
        <li key={i.label}>
          <span className={i.kind === 'rect' ? 'adm-key adm-key--rect' : 'adm-key'} style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

interface TipRow {
  label: string;
  value: string;
  color?: string;
}

function TipBox({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="adm-tip">
      <div className="adm-tip__title">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="adm-tip__row">
          {r.color ? (
            <span className="adm-key" style={{ background: r.color }} aria-hidden="true" />
          ) : (
            <span className="adm-key adm-key--none" aria-hidden="true" />
          )}
          <strong className="ev-num">{r.value}</strong>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Montant commandé et encaissé par période : deux courbes sur un seul axe (FCFA). */
export function EvolutionChart({ data, pas, height = 260 }: { data: PointEvolution[]; pas: Pas; height?: number }) {
  const c = useChartColors();
  const tick = { fill: c.muted, fontSize: 12, fontFamily: c.mono };
  const interval = data.length > 16 ? Math.ceil(data.length / 8) - 1 : 0;
  return (
    <div className="stack-sm">
      <Legende
        items={[
          { label: 'Montant commandé', color: 'var(--accent)' },
          { label: 'Encaissé (validé)', color: 'var(--st-ship-solid)' },
        ]}
      />
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 28, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} strokeWidth={1} />
            <XAxis
              dataKey="periode"
              tickFormatter={(d: string) => libelleAxe(d, pas)}
              tick={tick}
              tickLine={false}
              axisLine={{ stroke: c.grid }}
              interval={interval}
              minTickGap={8}
            />
            <YAxis tickFormatter={montantCourt} tick={tick} tickLine={false} axisLine={false} width={56} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: c.muted, strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]!.payload as PointEvolution;
                return (
                  <TipBox
                    title={libelleLong(String(label), pas)}
                    rows={[
                      { label: 'commandé', value: formatFCFA(p.montant_commandes), color: c.commande },
                      { label: 'encaissé', value: formatFCFA(p.encaisse), color: c.encaisse },
                      { label: p.commandes > 1 ? 'commandes' : 'commande', value: formatEntier(p.commandes) },
                    ]}
                  />
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="montant_commandes"
              name="Montant commandé"
              stroke={c.commande}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={data.length <= 1 ? { r: 4, fill: c.commande, stroke: c.surface, strokeWidth: 2 } : false}
              activeDot={{ r: 4, fill: c.commande, stroke: c.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="encaisse"
              name="Encaissé"
              stroke={c.encaisse}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={data.length <= 1 ? { r: 4, fill: c.encaisse, stroke: c.surface, strokeWidth: 2 } : false}
              activeDot={{ r: 4, fill: c.encaisse, stroke: c.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Nombre de commandes par période : une seule série, colonnes fines. */
export function CommandesChart({ data, pas, height = 180 }: { data: PointEvolution[]; pas: Pas; height?: number }) {
  const c = useChartColors();
  const tick = { fill: c.muted, fontSize: 12, fontFamily: c.mono };
  const interval = data.length > 16 ? Math.ceil(data.length / 8) - 1 : 0;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 28, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={c.grid} strokeWidth={1} />
          <XAxis
            dataKey="periode"
            tickFormatter={(d: string) => libelleAxe(d, pas)}
            tick={tick}
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            interval={interval}
            minTickGap={8}
          />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={56} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: c.grid, fillOpacity: 0.5 }}
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]!.payload as PointEvolution;
              return (
                <TipBox
                  title={libelleLong(String(label), pas)}
                  rows={[
                    { label: p.commandes > 1 ? 'commandes créées' : 'commande créée', value: formatEntier(p.commandes), color: c.commande },
                    { label: 'commandé', value: formatFCFA(p.montant_commandes) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="commandes" name="Commandes" fill={c.commande} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Durée moyenne en heures -> « 3,5 h », « 2 j 4 h ». */
export function formatDuree(heures: number | null | undefined): string {
  if (heures === null || heures === undefined || Number.isNaN(heures)) return '—';
  // L'API arrondit au dixième d'heure (6 min) : 0 signifie moins de 3 minutes.
  if (heures < 0.1) return 'moins de 6 min';
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  if (heures < 24) return `${heures.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;
  const total = Math.round(heures);
  const j = Math.floor(total / 24);
  const h = total % 24;
  return h ? `${j} j ${h} h` : `${j} j`;
}

/** Barres horizontales d'une seule série en HTML : libellé, barre proportionnelle, valeur toujours visible. */
export function BarresDelais({ data }: { data: { label: string; aide: string; heures: number | null; nb: number }[] }) {
  const max = Math.max(...data.map((d) => d.heures ?? 0), 0);
  return (
    <ul className="adm-bars">
      {data.map((d) => (
        <li key={d.label} className="adm-bars__row">
          <span className="adm-bars__label">
            {d.label}
            <span className="adm-sub">{d.aide}</span>
          </span>
          <span className="adm-bars__track" aria-hidden="true">
            {d.heures !== null && <span style={{ width: `${max > 0 ? Math.max(1.5, (d.heures / max) * 100) : 1.5}%` }} />}
          </span>
          <span className="adm-bars__value">
            <span className="ev-num">{formatDuree(d.heures)}</span>
            <span className="adm-sub">
              {d.nb} {d.nb > 1 ? 'dossiers' : 'dossier'}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
