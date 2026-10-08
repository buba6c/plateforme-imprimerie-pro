import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  calculerPrix,
  formatDecimal,
  formatEntier,
  formatFCFA,
  type ErreurPrix,
  type LignePrix,
  type Machine,
  type ParamsPrix,
  type ResultatPrix,
  type UniteTarif,
  TYPE_DOCUMENT_LABELS,
} from '@evocom/shared';
import type { Tarif } from '../../lib/types';
import { Alert } from '../../ui';
import { convertirSpecs, lignesDe, type Conversion, type SpecsDraft } from './draft';
import { versTarifsPrix } from './useTarifs';
import './specs.css';

/** Conversion du brouillon et calcul instantané du prix (le serveur recalcule et fait foi). */
export function usePrix(machine: Machine, draft: SpecsDraft, tarifs: Tarif[] | undefined, params: ParamsPrix) {
  const conversion = useMemo(() => convertirSpecs(machine, draft), [machine, draft]);
  const grille = useMemo(() => versTarifsPrix(tarifs), [tarifs]);
  const resultat = useMemo<ResultatPrix | ErreurPrix | null>(() => {
    if (!tarifs) return null;
    if (!conversion.apercu.lignes.length) return null;
    return calculerPrix(machine, conversion.apercu, grille, params);
  }, [machine, conversion, grille, params, tarifs]);
  return { conversion, resultat };
}

/** « 6,00 m² », « 500 faces », « 2 × forfait »… */
export function quantiteAvecUnite(q: number, unite: UniteTarif | string): string {
  switch (unite) {
    case 'm2':
      return `${formatDecimal(q, 2)} m²`;
    case 'ml':
      return `${formatDecimal(q, 2)} m`;
    case 'page':
      return `${formatEntier(q)} face${q > 1 ? 's' : ''}`;
    case 'feuille':
      return `${formatEntier(q)} feuille${q > 1 ? 's' : ''}`;
    case 'exemplaire':
      return `${formatEntier(q)} ex.`;
    case 'unite':
      return `${formatEntier(q)} u.`;
    case 'forfait':
      return q === 1 ? 'forfait' : `${formatEntier(q)} forfaits`;
    default:
      return '';
  }
}

/** Suffixe de prix unitaire : « /m² », « /face »… */
export function suffixeUnite(unite: UniteTarif | string): string {
  switch (unite) {
    case 'm2':
      return '/m²';
    case 'ml':
      return '/m';
    case 'page':
      return '/face';
    case 'feuille':
      return '/feuille';
    case 'exemplaire':
      return '/ex.';
    case 'unite':
      return '/u.';
    case 'forfait':
      return ' forfait';
    case 'pourcent':
      return ' %';
    default:
      return '';
  }
}

export function LignesPrix({ lignes, titreGroupe }: { lignes: LignePrix[]; titreGroupe: (groupe: number) => string }) {
  const groupes = useMemo(() => {
    const m = new Map<number, LignePrix[]>();
    for (const l of lignes) m.set(l.groupe, [...(m.get(l.groupe) ?? []), l]);
    return [...m.entries()].sort((a, b) => (a[0] === -1 ? 1 : b[0] === -1 ? -1 : a[0] - b[0]));
  }, [lignes]);
  return (
    <div className="sp-recu">
      {groupes.map(([g, ls]) => (
        <div key={g} className="sp-recu__groupe">
          <div className="sp-recu__titre">{titreGroupe(g)}</div>
          {ls.map((l, i) => (
            <div key={`${l.code}-${i}`} className="sp-recu__ligne">
              <span className="sp-recu__lib">{l.libelle}</span>
              <span className="ev-num sp-recu__total">{formatEntier(l.total)}</span>
              {l.unite !== 'pourcent' && l.total >= 0 && (
                <span className="sp-recu__calc ev-mono">
                  {quantiteAvecUnite(l.quantite, l.unite)} × {formatEntier(l.prix_unitaire)}
                </span>
              )}
              {l.explication && <span className="sp-recu__clair">{l.explication}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TotauxPrix({ r, params, montantRetenu }: { r: ResultatPrix; params: ParamsPrix; montantRetenu?: number | null }) {
  // Grille hors taxes : la TVA s'ajoute avant l'arrondi ; le total TTC est ensuite ventilé (HT + TVA = TTC).
  const tvaAjoutee = params.tva_applicable && params.prix_saisis_ht ? r.total_ttc - r.arrondi - (r.sous_total - r.remise) : 0;
  return (
    <dl className="sp-totaux">
      <div>
        <dt>Sous-total</dt>
        <dd className="ev-num">{formatEntier(r.sous_total)}</dd>
      </div>
      {r.remise > 0 && (
        <div>
          <dt>Remise</dt>
          <dd className="ev-num">−{formatEntier(r.remise)}</dd>
        </div>
      )}
      {tvaAjoutee > 0 && (
        <div>
          <dt>TVA {formatDecimal(params.tva_taux)} % ajoutée</dt>
          <dd className="ev-num">+{formatEntier(tvaAjoutee)}</dd>
        </div>
      )}
      {r.arrondi !== 0 && (
        <div>
          <dt>Arrondi{params.arrondi_pas ? ` (${formatEntier(params.arrondi_pas)} FCFA supérieur)` : ''}</dt>
          <dd className="ev-num">+{formatEntier(r.arrondi)}</dd>
        </div>
      )}
      <div className="sp-totaux__total" data-barre={montantRetenu !== undefined && montantRetenu !== null && montantRetenu !== r.total_ttc}>
        <dt>{params.tva_applicable ? 'Total TTC' : 'Total'}</dt>
        <dd className="ev-num">{formatFCFA(r.total_ttc)}</dd>
      </div>
      {params.tva_applicable && (
        <div className="sp-totaux__dont">
          <dt>Dont HT {formatEntier(r.total_ht)} · TVA {formatDecimal(params.tva_taux)} %</dt>
          <dd className="ev-num">{formatEntier(r.tva)}</dd>
        </div>
      )}
    </dl>
  );
}

interface PrixPanelProps {
  machine: Machine;
  draft: SpecsDraft;
  conversion: Conversion;
  resultat: ResultatPrix | ErreurPrix | null;
  params: ParamsPrix;
  parDefaut?: boolean;
  tarifsCharges: boolean;
  libelle: (machine: Machine, code: string) => string;
  /** L'utilisateur peut corriger la grille (lien vers Tarifs). */
  peutEditerTarifs?: boolean;
  /** Montant saisi à la main ou prix convenu (remplace le calcul). */
  montantRetenu?: number | null;
  /** Origine du montant retenu (« Prix du devis ») ; par défaut « Saisi à la main ». */
  libelleRetenu?: string;
  children?: ReactNode;
  titre?: string;
  /** Le formulaire propose la saisie manuelle du montant (dossier). */
  saisieManuelle?: boolean;
}

/** Panneau de prix en direct, réutilisé par le dossier et le devis. */
export function PrixPanel({
  machine,
  draft,
  conversion,
  resultat,
  params,
  parDefaut,
  tarifsCharges,
  libelle,
  peutEditerTarifs,
  montantRetenu,
  libelleRetenu,
  children,
  titre = 'Prix',
  saisieManuelle,
}: PrixPanelProps) {
  const lignes = lignesDe(machine, draft);
  const titreGroupe = (g: number) => {
    if (g === -1) return 'Services du dossier';
    const l = conversion.apercu.lignes[g] as (typeof conversion.apercu.lignes)[number] & { type_document?: keyof typeof TYPE_DOCUMENT_LABELS | null };
    const type = l?.type_document ? `${TYPE_DOCUMENT_LABELS[l.type_document]} · ` : '';
    return `Ligne ${indexOrigine(conversion, g) + 1} · ${type}${l ? libelle(machine, l.support) : ''}`;
  };
  const manuel = montantRetenu !== undefined && montantRetenu !== null;

  let contenu: ReactNode;
  if (!tarifsCharges) {
    contenu = <p className="ev-muted sp-prix__vide">Chargement de la grille tarifaire…</p>;
  } else if (!lignes.length) {
    contenu = <p className="ev-muted sp-prix__vide">Ajoutez une ligne de spécification pour calculer le prix. Sans ligne, le montant reste à définir.</p>;
  } else if (!conversion.apercu.lignes.length) {
    contenu = (
      <p className="ev-muted sp-prix__vide">
        Complétez {lignes.length > 1 ? 'les lignes' : 'la ligne'} ({machine === 'roland' ? 'support, dimensions, quantité' : 'format, pages, exemplaires'}) pour voir le prix.
      </p>
    );
  } else if (resultat && !resultat.ok) {
    contenu = (
      <Alert tone="warning">
        <strong>Prix incalculable</strong>
        <ul className="sp-erreurs">
          {resultat.erreurs.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <span>
          {peutEditerTarifs ? (
            <>
              Renseignez le prix manquant dans <Link className="ev-link" to="/admin/tarifs">Tarifs</Link>
            </>
          ) : (
            "Demandez à l'administrateur de renseigner ce prix dans Tarifs"
          )}
          {saisieManuelle ? ', ou saisissez le montant à la main.' : '.'}
        </span>
      </Alert>
    );
  } else if (resultat && resultat.ok) {
    contenu = (
      <>
        {!!resultat.avertissements?.length && (
          <Alert tone="warning">
            <strong>À vérifier</strong>
            <ul className="sp-erreurs">
              {resultat.avertissements.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        )}
        <LignesPrix lignes={resultat.lignes} titreGroupe={titreGroupe} />
        <TotauxPrix r={resultat} params={params} montantRetenu={montantRetenu} />
      </>
    );
  }

  return (
    <section className="ev-card sp-prix" aria-label={titre}>
      <header className="ev-card__head">
        <h2 className="ev-card__title">{titre}</h2>
        {manuel ? (
          <span className="sp-tag">{libelleRetenu ?? 'Saisi à la main'}</span>
        ) : (
          <span className="ev-muted sp-prix__note">Calcul en direct</span>
        )}
      </header>
      <div className="sp-prix__body">
        {contenu}
        {conversion.incompletes.length > 0 && conversion.apercu.lignes.length > 0 && (
          <p className="ev-help" style={{ margin: 0 }}>
            {conversion.incompletes.length > 1 ? 'Lignes' : 'Ligne'} {conversion.incompletes.map((i) => i + 1).join(', ')} incomplète
            {conversion.incompletes.length > 1 ? 's' : ''} : non comptée{conversion.incompletes.length > 1 ? 's' : ''}.
          </p>
        )}
        {manuel && (
          <div className="sp-totaux sp-totaux--retenu">
            <div className="sp-totaux__total">
              <dt>{libelleRetenu ?? 'Montant retenu'}</dt>
              <dd className="ev-num">{formatFCFA(montantRetenu)}</dd>
            </div>
          </div>
        )}
        {parDefaut && (
          <p className="ev-help" style={{ margin: 0 }}>
            Paramètres de prix par défaut : arrondi au {formatEntier(params.arrondi_pas)} FCFA supérieur, sans TVA.
          </p>
        )}
        {resultat && resultat.ok && !manuel && (
          <p className="ev-help" style={{ margin: 0 }}>
            Chaque ligne = quantité × prix de la grille Tarifs. Le serveur refait le calcul à l’enregistrement.
          </p>
        )}
      </div>
      {children && <div className="sp-prix__foot">{children}</div>}
    </section>
  );
}

/** Index de la ligne d'origine d'une ligne complète (les incomplètes sont sautées). */
function indexOrigine(c: Conversion, g: number): number {
  let n = -1;
  let i = -1;
  while (n < g) {
    i++;
    if (!c.incompletes.includes(i)) n++;
    if (i > 100) break;
  }
  return i;
}
