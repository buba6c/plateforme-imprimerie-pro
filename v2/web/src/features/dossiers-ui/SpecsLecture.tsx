// Rendu lisible des spécifications d'un dossier (ou d'un devis), pour l'atelier comme pour le bureau.

import { formatDecimal, formatEntier, formatFCFA, type LigneRoland, type LigneXerox, type Machine, type Specs } from '@evocom/shared';
import './dossiers-ui.css';

type Libelle = (machine: Machine, code: string) => string;

const K = { mm: 0.001, cm: 0.01, m: 1 } as const;

function pluriel(n: number, mot: string, motPluriel = `${mot}s`) {
  return `${formatEntier(n)} ${n > 1 ? motPluriel : mot}`;
}

export function SpecsLecture({ machine, specs, libelle, voirRemise, importe }: {
  machine: Machine;
  specs: Specs | null | undefined;
  libelle: Libelle;
  voirRemise?: boolean;
  importe?: boolean;
}) {
  const lignes = (specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  const forfaits = specs?.forfaits ?? [];
  const remise = specs?.remise ?? null;

  if (!lignes.length && importe && specs?.legacy) {
    return <DonneesAnciennes legacy={specs.legacy} />;
  }
  if (!lignes.length && !forfaits.length) {
    return <p className="ev-muted" style={{ margin: 0 }}>Aucune spécification détaillée. Voir la description et les fichiers.</p>;
  }

  return (
    <div className="fd-specs">
      {lignes.map((l, i) => (machine === 'roland' ? <LigneRolandLue key={i} i={i} l={l as LigneRoland} libelle={libelle} /> : <LigneXeroxLue key={i} i={i} l={l as LigneXerox} libelle={libelle} />))}
      {(forfaits.length > 0 || (voirRemise && remise && remise.valeur > 0)) && (
        <div className="fd-spec" style={{ gridTemplateColumns: '28px minmax(0, 1fr)' }}>
          <span aria-hidden="true" />
          <div className="stack-sm">
            {forfaits.length > 0 && (
              <div className="row" style={{ gap: 6 }}>
                <span className="ev-muted" style={{ fontSize: 13, marginRight: 4 }}>Forfaits du dossier</span>
                {forfaits.map((f) => (
                  <span key={f.code} className="fd-tag">
                    {libelle(machine, f.code)}
                    {f.quantite && f.quantite > 1 ? <span className="ev-mono">× {f.quantite}</span> : null}
                  </span>
                ))}
              </div>
            )}
            {voirRemise && remise && remise.valeur > 0 && (
              <div className="row" style={{ gap: 6, fontSize: 13 }}>
                <span className="ev-muted">Remise</span>
                <span className="ev-mono">{remise.type === 'pourcent' ? `${formatDecimal(remise.valeur)} %` : formatFCFA(remise.valeur)}</span>
                {remise.motif && <span className="ev-muted">· {remise.motif}</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Extras({ machine, l, libelle }: { machine: Machine; l: LigneRoland | LigneXerox; libelle: Libelle }) {
  if (!l.finitions?.length && !l.options?.length) return null;
  return (
    <div className="fd-spec__extra">
      {l.finitions?.map((f) => (
        <span key={`f-${f.code}`} className="fd-tag">
          {libelle(machine, f.code)}
          {f.quantite ? <span className="ev-mono">× {formatEntier(f.quantite)}</span> : null}
        </span>
      ))}
      {l.options?.map((o) => (
        <span key={`o-${o}`} className="fd-tag">
          {libelle(machine, o)}
        </span>
      ))}
    </div>
  );
}

function LigneRolandLue({ l, i, libelle }: { l: LigneRoland; i: number; libelle: Libelle }) {
  const k = K[l.unite ?? 'cm'] ?? 0.01;
  const unitaire = l.largeur * k * (l.hauteur * k);
  const totale = unitaire * l.quantite;
  return (
    <div className="fd-spec">
      <span className="fd-spec__num ev-mono">{String(i + 1).padStart(2, '0')}</span>
      <span className="fd-spec__titre">{libelle('roland', l.support)}</span>
      <span className="fd-spec__qte ev-num">{formatDecimal(totale, 2)} m²</span>
      <div className="fd-spec__faits">
        <span className="ev-mono">
          {formatDecimal(l.largeur)} × {formatDecimal(l.hauteur)} {l.unite}
        </span>
        <span>{pluriel(l.quantite, 'exemplaire')}</span>
        {l.quantite > 1 && <span>{formatDecimal(unitaire, 2)} m² l’unité</span>}
      </div>
      <Extras machine="roland" l={l} libelle={libelle} />
      {l.description && <p className="fd-spec__desc">{l.description}</p>}
    </div>
  );
}

function LigneXeroxLue({ l, i, libelle }: { l: LigneXerox; i: number; libelle: Libelle }) {
  const faces = l.pages * l.quantite;
  const feuilles = Math.ceil(l.pages / (l.recto_verso ? 2 : 1)) * l.quantite;
  return (
    <div className="fd-spec">
      <span className="fd-spec__num ev-mono">{String(i + 1).padStart(2, '0')}</span>
      <span className="fd-spec__titre">{libelle('xerox', l.support)}</span>
      <span className="fd-spec__qte ev-num">{pluriel(l.quantite, 'ex.', 'ex.')}</span>
      <div className="fd-spec__faits">
        <span>{pluriel(l.pages, 'page')}</span>
        <span>{l.recto_verso ? 'Recto-verso' : 'Recto seul'}</span>
        <span className="ev-mono">{pluriel(faces, 'face')}</span>
        <span className="ev-mono">{pluriel(feuilles, 'feuille')}</span>
      </div>
      <Extras machine="xerox" l={l} libelle={libelle} />
      {l.description && <p className="fd-spec__desc">{l.description}</p>}
    </div>
  );
}

function valeurLisible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (Array.isArray(v)) return v.map(valeurLisible).join(', ') || '—';
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== null && x !== undefined && x !== '')
      .map(([k, x]) => `${cleLisible(k)} : ${valeurLisible(x)}`)
      .join(' · ') || '—';
  }
  return String(v);
}

function cleLisible(k: string): string {
  const s = k.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Données d'origine d'un dossier repris de l'ancienne plateforme. */
function DonneesAnciennes({ legacy }: { legacy: unknown }) {
  const entrees = legacy && typeof legacy === 'object' && !Array.isArray(legacy) ? Object.entries(legacy as Record<string, unknown>) : [['Données', legacy] as const];
  const utiles = entrees.filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length));
  return (
    <div className="stack-sm">
      <p className="ev-help" style={{ margin: 0 }}>Dossier repris de l’ancienne plateforme : spécifications telles qu’elles avaient été saisies.</p>
      <dl className="fd-kv">
        {utiles.map(([k, v]) => (
          <div key={String(k)} style={{ display: 'contents' }}>
            <dt>{cleLisible(String(k))}</dt>
            <dd>{valeurLisible(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
