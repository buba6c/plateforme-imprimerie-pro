// Vues d'ensemble de l'imposition, en plus de la feuille unique :
//  - « Toutes les feuilles » : chaque feuille du plan (recto et verso), les unes sous les autres, à faire
//    défiler ; chaque feuille n'est dessinée que lorsqu'elle approche de l'écran (un livret de 25
//    feuilles n'affiche pas 100 visuels d'un coup) ;
//  - « Pages du document » : le livret tel qu'il se lira, page après page (couverture seule, puis les
//    doubles pages), avec les pages blanches ajoutées à leur place et, pour chaque page, la feuille et
//    la face où elle est imposée. Entre deux pages, « + » insère une page blanche (brochures à nombre
//    de pages impair : on choisit où va le blanc). Pour les autres opérations, la liste des pages.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { useApercuPage } from './rendu';
import { cadrePage, SchemaFeuille, type AffichageSchema } from './SchemaFeuille';
import type { Dimension, MethodeFondsPerdus, PageVirtuelle, Plan } from './types';

/** Rend ses enfants quand ils approchent de l'écran ; avant, un espace de la hauteur attendue. */
export function Paresseux({ hauteur, children }: { hauteur: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') return setVisible(true);
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);
  return (
    <div ref={ref} className="vp-paresseux" style={visible ? undefined : { minHeight: hauteur }}>
      {visible ? children : <span className="vp-paresseux__attente">Feuille en préparation…</span>}
    </div>
  );
}

interface ProprietesSchema {
  plan: Plan;
  pages: PageVirtuelle[];
  methode: MethodeFondsPerdus;
  sourceAvecFonds: boolean;
  unisDe: (n: number) => { haut: boolean; bas: boolean; gauche: boolean; droite: boolean } | null;
  dimsDe: (n: number) => Dimension | null;
  affichage: AffichageSchema;
}

/** Toutes les feuilles, à la verticale. Un clic sur une feuille l'ouvre dans la vue « Feuille ». */
export function ListeFeuilles({ plan, largeur, onChoisir, ...schema }: ProprietesSchema & { largeur: number; onChoisir: (index: number, cote: 'recto' | 'verso') => void }) {
  const hauteurFace = Math.round((largeur * plan.feuille.hauteur) / plan.feuille.largeur) + 60;
  return (
    <div className="vp-feuilles" role="list" aria-label="Toutes les feuilles">
      {plan.feuilles.map((f, i) => (
        <section key={f.numero} className="vp-feuille" role="listitem" aria-label={`Feuille ${f.numero}`}>
          <header className="vp-feuille__tete">
            <strong>{f.libelle ?? `Feuille ${f.numero}`}</strong>
            <span className="ev-muted">{f.numero} / {plan.feuilles.length}</span>
          </header>
          <Paresseux hauteur={hauteurFace}>
            <div className="vp-feuille__faces">
              {([f.recto, f.verso] as const).map((face) =>
                face ? (
                  <button key={face.cote} type="button" className="vp-feuille__face" onClick={() => onChoisir(i, face.cote)} title="Ouvrir cette face dans la vue Feuille">
                    <SchemaFeuille plan={plan} face={face} largeur={largeur} {...schema} />
                  </button>
                ) : null,
              )}
            </div>
          </Paresseux>
        </section>
      ))}
    </div>
  );
}

/** Vignette d'une page du document, recadrée au format fini (mise au format comprise). */
function MiniPage({ pg, plan, dims, largeur }: { pg: PageVirtuelle; plan: Plan; dims: Dimension | null; largeur: number }) {
  const cadre = dims && dims.largeur > 0 ? cadrePage(dims, plan.fini, plan.adaptation, 0) : undefined;
  const rendu = useApercuPage({ fichier_id: pg.libre ? undefined : pg.fichier_id, libre: pg.libre, page: pg.page_source, genre: pg.genre, demi: pg.demi, cadre }, largeur);
  const ratio = plan.fini.hauteur / plan.fini.largeur;
  return (
    <span className="vp-page__vignette" data-etat={rendu.etat} style={{ width: largeur, height: Math.round(largeur * ratio) }}>
      {rendu.etat === 'pret' && rendu.url ? <img src={rendu.url} alt="" /> : rendu.etat === 'chargement' ? <span className="vp-page__attente">…</span> : <span className="vp-page__attente">Aperçu indisponible</span>}
    </span>
  );
}

interface Emplacement {
  feuille: number;
  index: number;
  cote: 'recto' | 'verso';
  position: 'gauche' | 'droite' | 'haut' | 'bas' | number;
}

/** Où chaque page du document est imposée (première pose trouvée). */
function emplacements(plan: Plan): Map<number, Emplacement> {
  const m = new Map<number, Emplacement>();
  plan.feuilles.forEach((f, index) => {
    for (const face of [f.recto, f.verso]) {
      if (!face) continue;
      face.poses.forEach((q, k) => {
        if (q.page === null || m.has(q.page)) return;
        m.set(q.page, { feuille: f.numero, index, cote: face.cote, position: plan.operation === 'livret' ? (q.pli === 'bas' ? 'haut' : q.pli === 'haut' ? 'bas' : plan.livret?.reliure === 'feuilles_volantes' ? k + 1 : q.colonne === 0 ? 'gauche' : 'droite') : k + 1 });
      });
    }
  });
  return m;
}

export function PagesDocument({
  plan,
  pages,
  dimsDe,
  lecture = 'gauche_droite',
  blanchesManuelles,
  onInsererBlanche,
  onRetirerBlanche,
  onAller,
}: {
  plan: Plan;
  pages: PageVirtuelle[];
  dimsDe: (n: number) => Dimension | null;
  lecture?: 'gauche_droite' | 'droite_gauche';
  /** Positions (dans l'ordre de lecture) des blanches placées à la main. */
  blanchesManuelles: number[];
  /** Insérer une blanche après la k-ième page du document (0 = avant la première). */
  onInsererBlanche?: (k: number) => void;
  /** Retirer la blanche placée à la main après la k-ième page du document. */
  onRetirerBlanche?: (k: number) => void;
  onAller: (index: number, cote: 'recto' | 'verso') => void;
}) {
  const ou = emplacements(plan);
  const pageDe = (n: number) => pages.find((p) => p.numero === n) ?? null;
  const livret = plan.operation === 'livret' && plan.ordre;
  const largeur = Math.max(70, Math.min(150, Math.round(150 * Math.min(1, plan.fini.largeur / plan.fini.hauteur) * 1.2)));

  if (!livret) {
    // Autres opérations : les pages du document, dans l'ordre, avec leur pose.
    return (
      <div className="vp-pages" role="list" aria-label="Pages du document">
        {pages.map((pg) => {
          const e = ou.get(pg.numero);
          return (
            <button key={pg.numero} type="button" role="listitem" className="vp-page" onClick={() => e && onAller(e.index, e.cote)} title={e ? `Feuille ${e.feuille}, ${e.cote}` : 'Page non imposée'}>
              <MiniPage pg={pg} plan={plan} dims={dimsDe(pg.numero)} largeur={largeur} />
              <span className="vp-page__num">p.{pg.numero}</span>
              <span className="vp-page__ou">{e ? `F${e.feuille} ${e.cote === 'recto' ? 'R' : 'V'}${typeof e.position === 'number' ? ` · pose ${e.position}` : ''}` : 'non imposée'}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const ordre = plan.ordre!;
  const rtl = lecture === 'droite_gauche';
  // Doubles pages : [1], [2,3], [4,5], … [n]. Le compte des pages du document avant chaque trou donne
  // l'indice d'insertion d'une blanche.
  const avant: number[] = [];
  let compte = 0;
  for (let i = 0; i < ordre.length; i++) {
    avant.push(compte);
    if (ordre[i] !== null) compte++;
  }
  avant.push(compte);
  const manuelles = new Set(blanchesManuelles);
  const Insertion = ({ k, i }: { k: number; i: number }) =>
    onInsererBlanche ? (
      <button type="button" className="vp-plus" onClick={() => onInsererBlanche(k)} title={`Insérer une page blanche ${i === 0 ? 'avant la première page' : i >= ordre.length ? 'après la dernière page' : `entre les pages ${i} et ${i + 1}`}`} aria-label="Insérer une page blanche ici">
        <Plus width={12} height={12} />
      </button>
    ) : null;
  const Cellule = ({ i }: { i: number }) => {
    const n = ordre[i]!;
    const e = n !== null ? ou.get(n) : null;
    const pg = n !== null ? pageDe(n) : null;
    const manuelle = manuelles.has(i);
    return (
      <div className="vp-page" data-blanche={n === null || undefined} data-manuelle={manuelle || undefined}>
        {pg ? (
          <button type="button" className="vp-page__bouton" onClick={() => e && onAller(e.index, e.cote)} title={e ? `Feuille ${e.feuille}, ${e.cote}, page de ${e.position}` : ''}>
            <MiniPage pg={pg} plan={plan} dims={dimsDe(pg.numero)} largeur={largeur} />
          </button>
        ) : (
          <span className="vp-page__vignette vp-page__vignette--blanche" style={{ width: largeur, height: Math.round((largeur * plan.fini.hauteur) / plan.fini.largeur) }}>
            <span>Page blanche</span>
            {manuelle && onRetirerBlanche && (
              <button type="button" className="vp-page__retirer" onClick={() => onRetirerBlanche(avant[i]!)} aria-label="Retirer cette page blanche" title="Retirer cette page blanche">
                <X width={12} height={12} />
              </button>
            )}
          </span>
        )}
        <span className="vp-page__num">{i + 1}{n !== null && n !== i + 1 ? <small> (p.{n} du fichier)</small> : null}</span>
        <span className="vp-page__ou">{e ? `Feuille ${e.feuille} · ${e.cote} · ${e.position}` : n === null ? (manuelle ? 'ajoutée à la main' : 'ajoutée (multiple de 4)') : ''}</span>
      </div>
    );
  };
  // Groupes affichés : [1], [2, 3], [4, 5], …, [n]. Chaque intervalle entre deux pages a un seul « + » :
  // avant la première page de chaque groupe, entre les deux pages d'une double, après la dernière page.
  const groupes: number[][] = [];
  if (ordre.length) groupes.push([0]);
  for (let i = 1; i < ordre.length - 1; i += 2) groupes.push([i, i + 1]);
  if (ordre.length > 1) groupes.push([ordre.length - 1]);
  return (
    <div className="vp-livret" aria-label="Pages du livret, dans l'ordre de lecture">
      <p className="ev-help" style={{ margin: 0 }}>
        Le livret tel qu'il se lira : {ordre.length} pages{plan.pages_blanches ? `, dont ${plan.pages_blanches} blanche${plan.pages_blanches > 1 ? 's' : ''}` : ''}. Cliquez une page pour ouvrir sa feuille{onInsererBlanche ? ', « + » pour insérer une page blanche' : ''}.
      </p>
      <div className="vp-livret__suite" data-rtl={rtl || undefined}>
        {groupes.map((g, gi) => (
          <div key={gi} className="vp-double" data-seule={g.length === 1 || undefined}>
            <Insertion k={avant[g[0]!]!} i={g[0]!} />
            <div className="vp-double__pages">
              {(rtl ? [...g].reverse() : g).map((i, j) => (
                <span key={i} className="vp-double__page" data-cote={g.length === 1 ? ((g[0] === 0) !== rtl ? 'droite' : 'gauche') : j === 0 ? 'gauche' : 'droite'}>
                  <Cellule i={i} />
                  {g.length === 2 && j === 0 && <Insertion k={avant[g[1]!]!} i={g[1]!} />}
                </span>
              ))}
            </div>
            {gi === groupes.length - 1 && <Insertion k={avant[ordre.length]!} i={ordre.length} />}
          </div>
        ))}
      </div>
    </div>
  );
}
