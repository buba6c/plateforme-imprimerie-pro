// Briques de la grille de fichiers : carte avec vignette, ligne de liste, case de sélection, barre d'actions,
// tri, bascule Grille / Liste, sélection multiple. Partagées par les onglets Fichiers et Corbeille.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { File, LayoutGrid, List as ListeIcone } from 'lucide-react';
import { MACHINE_LABELS, formatTaille, type Machine } from '@evocom/shared';
import { fichierUrl } from '../../lib/api';
import { extension } from '../fichiers/ListeFichiers';
import { VIGNETTE_PDF_MAX, VignettePdf } from './VignettePdf';
import type { Categorie, FichierGlobal } from './types';

// ---------------------------------------------------------------------------
// Type de fichier

const IMAGES_AFFICHABLES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export function libelleType(f: Pick<FichierGlobal, 'categorie' | 'nom_original'>): string {
  if (f.categorie === 'pdf') return 'PDF';
  if (f.categorie === 'image') return 'IMG';
  return extension(f.nom_original);
}

export function IconeType({ categorie, nom, taille = 44 }: { categorie: Categorie; nom: string; taille?: number }) {
  return (
    <span className="fa-icone-type" data-type={categorie} aria-hidden="true">
      <File size={taille} strokeWidth={1.4} />
      <span className="fa-icone-type__ext">{extension(nom)}</span>
    </span>
  );
}

/** Vignette : l'image elle-même, la première page d'un PDF, ou une grande icône de type. */
export function Vignette({ f, contenu }: { f: FichierGlobal; contenu: boolean }) {
  const [imageKo, setImageKo] = useState(false);
  const icone = <IconeType categorie={f.categorie} nom={f.nom_original} />;
  if (!contenu) return icone;
  if (f.mime === 'application/pdf') return <VignettePdf id={f.id} taille={f.taille} nom={f.nom_original} repli={icone} />;
  if (f.mime && IMAGES_AFFICHABLES.includes(f.mime) && f.taille <= VIGNETTE_PDF_MAX && !imageKo) {
    return <img className="fa-vignette-image" src={fichierUrl(f.id)} alt={`Aperçu de ${f.nom_original}`} loading="lazy" decoding="async" onError={() => setImageKo(true)} />;
  }
  return icone;
}

// ---------------------------------------------------------------------------
// Petits éléments

export function PuceMachine({ machine }: { machine: Machine }) {
  return (
    <span className="fa-puce" data-machine={machine}>
      {MACHINE_LABELS[machine] ?? machine}
    </span>
  );
}

export function CaseSelection({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <label className={['ev-check fa-case', className].filter(Boolean).join(' ')} title={label} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ev-check__box" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </label>
  );
}

/**
 * Carte d'un fichier. `onOuvrir` rend la vignette et le nom cliquables (aperçu) ; sans lui, un clic
 * sur la carte coche ou décoche le fichier.
 */
export function CarteFichier({
  f,
  selectionne,
  onSelection,
  onOuvrir,
  contenu = true,
  meta,
  badges,
  pied,
  actif,
}: {
  f: FichierGlobal;
  selectionne: boolean;
  onSelection?: (v: boolean) => void;
  onOuvrir?: () => void;
  contenu?: boolean;
  meta?: ReactNode;
  badges?: ReactNode;
  pied?: ReactNode;
  actif?: boolean;
}) {
  const corps = (
    <>
      <div className="fa-card__vignette" data-type={f.categorie}>
        <Vignette f={f} contenu={contenu} />
      </div>
      <div className="fa-card__corps">
        <span className="fa-card__nom" title={f.nom_original}>
          {f.nom_original}
        </span>
        <span className="fa-card__meta">
          <strong className="ev-num">{formatTaille(f.taille)}</strong>
          <span className="ev-ref">{f.dossier_numero}</span>
        </span>
        <span className="fa-card__client" title={f.client_nom}>
          {f.client_nom}
        </span>
        {meta}
      </div>
    </>
  );
  return (
    <article className="fa-card" data-selected={selectionne} data-actif={actif || undefined}>
      {onOuvrir ? (
        <button type="button" className="fa-card__ouvrir" onClick={onOuvrir} aria-label={`Aperçu de ${f.nom_original}`}>
          {corps}
        </button>
      ) : (
        <div className="fa-card__ouvrir" data-cliquable={!!onSelection} onClick={() => onSelection?.(!selectionne)}>
          {corps}
        </div>
      )}
      <span className="fa-card__badge" data-type={f.categorie} aria-hidden="true">
        {libelleType(f)}
      </span>
      {onSelection && <CaseSelection className="fa-card__check" checked={selectionne} onChange={onSelection} label={`Sélectionner ${f.nom_original}`} />}
      <div className="fa-card__pied">
        <span className="fa-card__badges">
          <PuceMachine machine={f.machine} />
          {badges}
        </span>
        {pied}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Barre d'outils

export type Vue = 'grille' | 'liste';
const CLE_VUE = 'evocom.fichiers.vue';

export function useVue(): [Vue, (v: Vue) => void] {
  const [vue, setVue] = useState<Vue>(() => {
    try {
      return localStorage.getItem(CLE_VUE) === 'liste' ? 'liste' : 'grille';
    } catch {
      return 'grille';
    }
  });
  const changer = useCallback((v: Vue) => {
    setVue(v);
    try {
      localStorage.setItem(CLE_VUE, v);
    } catch {
      /* stockage indisponible : le choix vaut pour cette visite */
    }
  }, []);
  return [vue, changer];
}

export function BasculeVue({ vue, onChange }: { vue: Vue; onChange: (v: Vue) => void }) {
  return (
    <div className="fa-bascule" role="group" aria-label="Affichage">
      <button type="button" aria-pressed={vue === 'grille'} onClick={() => onChange('grille')}>
        <LayoutGrid aria-hidden="true" />
        Grille
      </button>
      <button type="button" aria-pressed={vue === 'liste'} onClick={() => onChange('liste')}>
        <ListeIcone aria-hidden="true" />
        Liste
      </button>
    </div>
  );
}

export function Tris<T extends string>({ valeur, options, onChange }: { valeur: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="fa-tris" role="group" aria-label="Trier les fichiers">
      <span className="fa-tris__titre" aria-hidden="true">
        Trier
      </span>
      {options.map((o) => (
        <button key={o.value} type="button" className="fa-tri" aria-pressed={valeur === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Barre collante affichée dès qu'un fichier est coché. */
export function BarreSelection({ nb, taille, children, onAnnuler }: { nb: number; taille: number; children: ReactNode; onAnnuler: () => void }) {
  if (nb === 0) return null;
  return (
    <div className="fa-barre" role="region" aria-label="Actions sur la sélection">
      <span className="fa-barre__total" aria-live="polite">
        <strong className="ev-num">{nb}</strong> {nb > 1 ? 'fichiers sélectionnés' : 'fichier sélectionné'} · <strong className="ev-num">{formatTaille(taille)}</strong>
      </span>
      <span className="fa-barre__actions">
        {children}
        <button type="button" className="ev-btn ev-btn--sm ev-btn--ghost fa-barre__annuler" onClick={onAnnuler}>
          Annuler la sélection
        </button>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sélection multiple (garde les fichiers cochés d'une page à l'autre)

export function useSelection<T extends { id: number; taille: number }>() {
  const [choix, setChoix] = useState<Map<number, T>>(() => new Map());
  const basculer = useCallback((f: T, v: boolean) => {
    setChoix((m) => {
      const n = new Map(m);
      if (v) n.set(f.id, f);
      else n.delete(f.id);
      return n;
    });
  }, []);
  const plusieurs = useCallback((fs: T[], v: boolean) => {
    setChoix((m) => {
      const n = new Map(m);
      for (const f of fs) {
        if (v) n.set(f.id, f);
        else n.delete(f.id);
      }
      return n;
    });
  }, []);
  const vider = useCallback(() => setChoix(new Map()), []);
  const retirer = useCallback((ids: number[]) => {
    setChoix((m) => {
      const n = new Map(m);
      for (const id of ids) n.delete(id);
      return n;
    });
  }, []);
  const liste = useMemo(() => [...choix.values()], [choix]);
  const taille = useMemo(() => liste.reduce((t, f) => t + f.taille, 0), [liste]);
  return { choix, liste, taille, nb: choix.size, a: (id: number) => choix.has(id), basculer, plusieurs, vider, retirer };
}

/** Case « Tout sélectionner (page) » : cochée si tous les fichiers de la page le sont. */
export function ToutSelectionner<T extends { id: number; taille: number }>({ items, sel }: { items: T[]; sel: ReturnType<typeof useSelection<T>> }) {
  const tous = items.length > 0 && items.every((f) => sel.a(f.id));
  return (
    <label className="ev-check fa-tout">
      <input type="checkbox" checked={tous} onChange={(e) => sel.plusieurs(items, e.target.checked)} disabled={!items.length} />
      <span className="ev-check__box" aria-hidden="true" />
      Tout sélectionner (page)
    </label>
  );
}

/** Lance les téléchargements un par un (le navigateur peut demander d'autoriser les téléchargements multiples). */
export async function telechargerUnParUn(fichiers: Pick<FichierGlobal, 'id' | 'nom_original'>[], pause = 700) {
  for (const f of fichiers) {
    const a = document.createElement('a');
    a.href = fichierUrl(f.id, true);
    a.download = f.nom_original;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    await new Promise((ok) => setTimeout(ok, pause));
  }
}
