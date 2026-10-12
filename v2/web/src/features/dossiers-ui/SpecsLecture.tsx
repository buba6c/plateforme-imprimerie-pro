// Rendu lisible des spécifications d'un dossier (ou d'un devis), pour l'atelier comme pour le bureau :
// même présentation que les dossiers repris de l'ancienne plateforme (bandeau de la machine, sections
// colorées, tuiles « libellé / valeur », pastilles pleines, pictogrammes), une par ligne.
import { Boxes, FileText, Hash, Layers, Package, Palette, Ruler, Scissors, Sparkles, Tag } from 'lucide-react';
import {
  BORDS_LABELS,
  CONDITIONNEMENT_LABELS,
  COULEUR_LABELS,
  FORMAT_XEROX_LABELS,
  FORMAT_XEROX_MM,
  formatDecimal,
  formatEntier,
  formatFCFA,
  MACHINE_LABELS,
  nombreOeillets,
  PAPIER_LABELS,
  PARTIE_LABELS,
  POSITION_OEILLETS_LABELS,
  TYPE_DOCUMENT_LABELS,
  libelleSupportLigne,
  type LigneRoland,
  type LigneXerox,
  type Machine,
  type Specs,
} from '@evocom/shared';
import { IconeFaces } from '../specs/SpecsEditor';
import { SpecsAnciennes } from './SpecsAnciennes';
import './dossiers-ui.css';
import './specs-anciennes.css';

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
    return <SpecsAnciennes machine={machine} legacy={specs.legacy} />;
  }
  if (!lignes.length && !forfaits.length) {
    return <p className="ev-muted" style={{ margin: 0 }}>Aucune spécification détaillée. Voir la description et les fichiers.</p>;
  }

  return (
    <div className="sa">
      {lignes.map((l, i) => (
        <article key={i} className="sa__formulaire">
          <header className="sa__entete" data-machine={machine}>
            <h3>
              <span className="sa__num">{String(i + 1).padStart(2, '0')}</span>
              {machine === 'roland' ? libelleSupportLigne(l, libelle('roland', l.support)) : titreXerox(l as LigneXerox, libelle)}
            </h3>
            <span className="sa__pastille">{machine === 'roland' ? 'Grand format Roland' : 'Numérique Xerox'}</span>
          </header>
          <div className="sa__corps">{machine === 'roland' ? <LigneRolandLue l={l as LigneRoland} libelle={libelle} /> : <LigneXeroxLue l={l as LigneXerox} libelle={libelle} />}</div>
        </article>
      ))}
      {(forfaits.length > 0 || (voirRemise && remise && remise.valeur > 0)) && (
        <article className="sa__formulaire">
          <header className="sa__entete" data-machine={machine}>
            <h3>
              <Package aria-hidden="true" />
              Pour tout le dossier
            </h3>
            <span className="sa__pastille">{MACHINE_LABELS[machine]}</span>
          </header>
          <div className="sa__corps">
            {forfaits.length > 0 && (
              <Section tone="emerald" titre="Forfaits et services">
                <Chips valeurs={forfaits.map((f) => `${libelle(machine, f.code)}${f.quantite && f.quantite > 1 ? ` × ${f.quantite}` : ''}`)} />
              </Section>
            )}
            {voirRemise && remise && remise.valeur > 0 && (
              <Section tone="orange" titre="Remise commerciale">
                <div className="sa-tuiles">
                  <Tuile libelle="Remise" valeur={remise.type === 'pourcent' ? `${formatDecimal(remise.valeur)} %` : formatFCFA(remise.valeur)} grande />
                  {remise.motif && <Tuile libelle="Motif" valeur={remise.motif} />}
                </div>
              </Section>
            )}
          </div>
        </article>
      )}
    </div>
  );
}

function titreXerox(l: LigneXerox, libelle: Libelle): string {
  const type = l.type_document ? TYPE_DOCUMENT_LABELS[l.type_document] : libelleSupportLigne(l, libelle('xerox', l.support));
  const partie = l.partie && l.partie !== 'unique' ? ` · ${PARTIE_LABELS[l.partie].toLowerCase()}` : '';
  return `${type}${partie}`;
}

// ---------------------------------------------------------------------------
// Blocs réutilisés (mêmes classes que la fiche des dossiers importés)

function Section({ tone, titre, icone: Icone, children }: { tone: string; titre: string; icone?: typeof FileText; children: React.ReactNode }) {
  return (
    <section className="sa-section" data-tone={tone}>
      <h4 className="sa-section__titre">
        {Icone && <Icone aria-hidden="true" className="sa-section__icone" />}
        {titre}
      </h4>
      {children}
    </section>
  );
}

function Tuile({ libelle, valeur, tone, grande, enfant }: { libelle: string; valeur?: string; tone?: string; grande?: boolean; enfant?: React.ReactNode }) {
  return (
    <div className="sa-tuile" data-tone={tone}>
      <p className="sa-tuile__libelle">{libelle}</p>
      {enfant ?? <p className={`sa-tuile__valeur${grande ? ' sa-tuile__valeur--grande' : ''}`}>{valeur}</p>}
    </div>
  );
}

function Chips({ valeurs, vide = 'Aucune', petite, tone }: { valeurs: string[]; vide?: string; petite?: boolean; tone?: string }) {
  if (!valeurs.length) return <p className="sa-vide">{vide}</p>;
  return (
    <ul className={`sa-chips${tone ? ` sa-chips--${tone}` : ''}`}>
      {valeurs.map((v) => (
        <li key={v} className={`sa-chip${petite ? ' sa-chip--petite' : ''}`}>
          {v}
        </li>
      ))}
    </ul>
  );
}

function Faces({ faces, texte }: { faces: 'recto' | 'recto_verso'; texte: string }) {
  return (
    <p className="sa-tuile__valeur sa-faces-valeur">
      <IconeFaces faces={faces} />
      {texte}
    </p>
  );
}

// ---------------------------------------------------------------------------

function LigneXeroxLue({ l, libelle }: { l: LigneXerox; libelle: Libelle }) {
  const faces = l.pages * l.quantite;
  const feuilles = Math.ceil(l.pages / (l.recto_verso ? 2 : 1)) * l.quantite;
  const dims: [number, number] | null = l.format && l.format !== 'perso' ? FORMAT_XEROX_MM[l.format] : l.format_largeur && l.format_hauteur ? [l.format_largeur, l.format_hauteur] : null;
  const format = l.format ? FORMAT_XEROX_LABELS[l.format] : libelleSupportLigne(l, libelle('xerox', l.support));
  const finitions = (l.finitions ?? []).map((f) => `${libelle('xerox', f.code)}${f.quantite ? ` × ${formatEntier(f.quantite)}` : ''}`);
  const options = (l.options ?? []).map((o) => libelle('xerox', o));
  const conditionnement = (l.conditionnement ?? []).map((c) => CONDITIONNEMENT_LABELS[c] ?? c);
  return (
    <>
      <Section tone="violet" titre="Document" icone={FileText}>
        <div className="sa-tuiles">
          {l.type_document && <Tuile libelle="Type" valeur={TYPE_DOCUMENT_LABELS[l.type_document]} />}
          {l.partie && l.partie !== 'unique' && <Tuile libelle="Partie" valeur={PARTIE_LABELS[l.partie]} />}
          <Tuile libelle="Format" valeur={`${format}${dims ? ` · ${formatDecimal(dims[0])} × ${formatDecimal(dims[1])} mm` : ''}`} />
          {l.format && l.format !== 'perso' && l.support && <Tuile libelle="Tarif appliqué" valeur={libelleSupportLigne(l, libelle('xerox', l.support))} />}
        </div>
      </Section>
      <Section tone="cyan" titre="Impression" icone={Palette}>
        <div className="sa-tuiles">
          <Tuile libelle="Faces" enfant={<Faces faces={l.recto_verso ? 'recto_verso' : 'recto'} texte={l.recto_verso ? 'Recto-verso' : 'Recto seul'} />} />
          {l.couleur && <Tuile libelle="Couleur" valeur={COULEUR_LABELS[l.couleur]} />}
          <Tuile libelle="Pages par exemplaire" valeur={pluriel(l.pages, 'page')} />
          <Tuile tone="emerald" libelle="Quantité" valeur={`${formatEntier(l.quantite)} ex.`} grande />
          <Tuile libelle="Total à imprimer" valeur={`${pluriel(faces, 'face')} · ${pluriel(feuilles, 'feuille')}`} />
        </div>
      </Section>
      <Section tone="orange" titre="Papier" icone={Layers}>
        <div className="sa-tuile sa-tuile--icone">
          <span className="sa-tuile__icone">
            <Layers aria-hidden="true" />
          </span>
          <div>
            <p className="sa-tuile__libelle">Papier</p>
            <p className="sa-tuile__valeur sa-tuile__valeur--grande">{l.papier ? PAPIER_LABELS[l.papier] : 'Ordinaire 80 g (compris)'}</p>
          </div>
        </div>
      </Section>
      <Section tone="rose" titre="Finitions" icone={Sparkles}>
        {l.pelliculage || finitions.length ? (
          <div className="stack-sm">
            {l.pelliculage && (
              <div className="sa-tuiles">
                <Tuile libelle="Pelliculage" valeur={l.pelliculage.type === 'mat' ? 'Mat' : 'Brillant'} />
                <Tuile libelle="Faces pelliculées" enfant={<Faces faces={l.pelliculage.faces === 'recto_verso' ? 'recto_verso' : 'recto'} texte={l.pelliculage.faces === 'recto_verso' ? 'Recto-verso' : 'Recto'} />} />
              </div>
            )}
            <Chips valeurs={finitions} vide="Aucune finition demandée" />
          </div>
        ) : (
          <p className="sa-vide">Aucune finition demandée</p>
        )}
      </Section>
      {(options.length > 0 || l.numerotation || conditionnement.length > 0) && (
        <Section tone="indigo" titre="Options" icone={Boxes}>
          <div className="stack-sm">
            {options.length > 0 && <Chips valeurs={options} tone="teal" petite />}
            <div className="sa-tuiles">
              {l.numerotation && (
                <div className="sa-tuile" data-tone="slate">
                  <p className="sa-tuile__libelle">
                    <Hash aria-hidden="true" style={{ width: 12, height: 12, verticalAlign: '-2px' }} /> Numérotation
                  </p>
                  <p className="sa-tuile__valeur">
                    À partir de {formatEntier(l.numerotation.depart ?? 1)} · {l.numerotation.chiffres ?? 4} chiffres
                  </p>
                </div>
              )}
              {conditionnement.length > 0 && (
                <div className="sa-tuile" data-tone="teal">
                  <p className="sa-tuile__libelle">Conditionnement</p>
                  <Chips valeurs={conditionnement} tone="teal" petite />
                </div>
              )}
            </div>
          </div>
        </Section>
      )}
      {l.description && (
        <Section tone="slate" titre="Précisions pour l’atelier" icone={Tag}>
          <p className="sa-texte">{l.description}</p>
        </Section>
      )}
    </>
  );
}

function LigneRolandLue({ l, libelle }: { l: LigneRoland; libelle: Libelle }) {
  const k = K[l.unite ?? 'cm'] ?? 0.01;
  const unitaire = l.largeur * k * (l.hauteur * k);
  const totale = unitaire * l.quantite;
  const bords = l.bords && l.bords !== 'aucun' ? l.bords : null;
  const oeillets = bords === 'oeillets' ? nombreOeillets({ largeur: l.largeur, hauteur: l.hauteur, unite: l.unite, quantite: l.quantite, oeillets: l.oeillets ?? undefined }) : null;
  const finitions = (l.finitions ?? []).map((f) => `${libelle('roland', f.code)}${f.quantite ? ` × ${formatEntier(f.quantite)}` : ''}`);
  const options = (l.options ?? []).map((o) => libelle('roland', o));
  return (
    <>
      <Section tone="violet" titre="Support" icone={FileText}>
        <div className="sa-tuile sa-tuile--icone">
          <span className="sa-tuile__icone">
            <FileText aria-hidden="true" />
          </span>
          <div>
            <p className="sa-tuile__libelle">Type de support</p>
            <p className="sa-tuile__valeur sa-tuile__valeur--grande">{libelleSupportLigne(l, libelle('roland', l.support))}</p>
          </div>
        </div>
      </Section>
      <Section tone="cyan" titre="Dimensions" icone={Ruler}>
        <div className="sa-dims">
          <div className="sa-dims__ligne">
            <div className="sa-dims__cote">
              <small>Largeur</small>
              <strong className="ev-num">{formatDecimal(l.largeur)}</strong>
              <span>{l.unite}</span>
            </div>
            <span className="sa-dims__fois" aria-hidden="true">
              ×
            </span>
            <div className="sa-dims__cote">
              <small>Hauteur</small>
              <strong className="ev-num">{formatDecimal(l.hauteur)}</strong>
              <span>{l.unite}</span>
            </div>
          </div>
          <div className="sa-dims__pied">
            <Tuile tone="emerald" libelle="Surface" valeur={`${formatDecimal(unitaire, 2)} m² l’unité${l.quantite > 1 ? ` · ${formatDecimal(totale, 2)} m² au total` : ''}`} />
            <Tuile tone="emerald" libelle="Quantité" valeur={`${formatEntier(l.quantite)} ex.`} grande />
          </div>
        </div>
      </Section>
      <Section tone="rose" titre="Bords et finitions" icone={Scissors}>
        {bords || finitions.length ? (
          <div className="stack-sm">
            {bords && (
              <div className="sa-tuiles">
                <Tuile libelle="Bords" valeur={BORDS_LABELS[bords]} />
                {oeillets && <Tuile libelle="Œillets" valeur={`${formatEntier(oeillets.parExemplaire)} par exemplaire${l.quantite > 1 ? ` · ${formatEntier(oeillets.total)} au total` : ''}`} />}
                {bords === 'oeillets' && <Tuile libelle="Position" valeur={POSITION_OEILLETS_LABELS[l.oeillets?.position ?? 'tous_cotes']} />}
              </div>
            )}
            <Chips valeurs={finitions} vide="Aucune finition demandée" />
          </div>
        ) : (
          <p className="sa-vide">Aucune finition demandée</p>
        )}
      </Section>
      {options.length > 0 && (
        <Section tone="indigo" titre="Options" icone={Boxes}>
          <Chips valeurs={options} tone="teal" petite />
        </Section>
      )}
      {l.description && (
        <Section tone="slate" titre="Précisions pour l’atelier" icone={Tag}>
          <p className="sa-texte">{l.description}</p>
        </Section>
      )}
    </>
  );
}
