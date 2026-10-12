// Formulaire d'origine d'un dossier repris de l'ancienne plateforme, présenté comme l'ancienne
// version le faisait (c'est la lecture à laquelle l'atelier est habitué) : bandeau de la machine,
// sections empilées « Document », « Impression », « Papier », « Finitions », « Façonnage »,
// « Options » (Xerox) ou « Support », « Dimensions », « Finitions » (Roland), tuiles et pastilles
// pleines. Les données viennent de `formulairesAnciens` (paquet partagé, aussi utilisé par le PDF).
import { FileText, Layers, Printer } from 'lucide-react';
import { cleLisible, formatDate, formulairesAnciens, texteAncien, valeurVide, type FormulaireAncien, type Machine, type SectionAncienne } from '@evocom/shared';
import './specs-anciennes.css';

export function SpecsAnciennes({ machine, legacy }: { machine: Machine; legacy: unknown }) {
  const forms = formulairesAnciens(machine, legacy);
  if (!forms.length) return <DonneesBrutes legacy={legacy} />;
  return (
    <div className="sa">
      {forms.map((f, i) => (
        <article key={f.id ?? i} className="sa__formulaire" data-ancien={i > 0 || undefined}>
          <header className="sa__entete" data-machine={f.type}>
            <h3>
              <Printer aria-hidden="true" />
              {f.type === 'roland' ? 'Grand format Roland' : 'Impression numérique Xerox'}
            </h3>
            <span className="sa__pastille">{forms.length > 1 ? (i === 0 ? 'Dernière saisie' : 'Saisie précédente') : 'Formulaire d’origine'}</span>
          </header>
          <div className="sa__corps">{f.type === 'roland' ? <Roland f={f} /> : <Xerox f={f} />}</div>
          {(f.date_saisie || f.id) && (
            <p className="sa__saisie">
              Repris de l’ancienne plateforme{f.date_saisie ? ` · saisi le ${formatDate(f.date_saisie)}` : ''}
              {f.id ? ` · formulaire n° ${f.id}` : ''}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

const section = (f: FormulaireAncien, cle: SectionAncienne['cle']) => f.sections.find((s) => s.cle === cle);
const item = (s: SectionAncienne | undefined, libelle: string) => s?.items.find(([k]) => k === libelle)?.[1];

function Section({ tone, titre, children }: { tone: string; titre: string; children: React.ReactNode }) {
  return (
    <section className="sa-section" data-tone={tone}>
      <h4 className="sa-section__titre">{titre}</h4>
      {children}
    </section>
  );
}

function Tuile({ libelle, valeur, tone, grande }: { libelle: string; valeur: string; tone?: string; grande?: boolean }) {
  return (
    <div className="sa-tuile" data-tone={tone}>
      <p className="sa-tuile__libelle">{libelle}</p>
      <p className={`sa-tuile__valeur${grande ? ' sa-tuile__valeur--grande' : ''}`}>{valeur}</p>
    </div>
  );
}

function Chips({ valeurs, vide, petite, tone }: { valeurs: string[]; vide: string; petite?: boolean; tone?: string }) {
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

function Xerox({ f }: { f: FormulaireAncien }) {
  const doc = section(f, 'document');
  const quantite = section(f, 'quantite');
  const papier = section(f, 'papier');
  const finitions = section(f, 'finition');
  const faconnage = section(f, 'faconnage');
  const conditionnement = section(f, 'conditionnement');
  const numerotation = section(f, 'numerotation');
  const type = item(doc, 'Type');
  const format = item(doc, 'Format');
  const grammage = item(papier, 'Grammage');
  return (
    <>
      <Section tone="violet" titre="Document">
        {type || format ? (
          <div className="sa-tuiles">
            {type && <Tuile libelle="Type" valeur={type} />}
            {format && <Tuile libelle="Format" valeur={format} />}
          </div>
        ) : (
          <p className="sa-vide">Type et format non précisés</p>
        )}
      </Section>
      <Section tone="cyan" titre="Impression">
        <div className="sa-tuiles">
          {item(doc, 'Impression') && <Tuile libelle="Mode" valeur={item(doc, 'Impression')!} />}
          {item(doc, 'Couleur') && <Tuile libelle="Couleur" valeur={item(doc, 'Couleur')!} />}
          {quantite?.grand ? (
            <Tuile tone="emerald" libelle="Quantité" valeur={`${quantite.grand.valeur} ex.${quantite.grand.detail ? ` · ${quantite.grand.detail}` : ''}`} grande />
          ) : (
            <Tuile tone="emerald" libelle="Quantité" valeur="Non précisée" />
          )}
        </div>
      </Section>
      <Section tone="orange" titre="Papier">
        {grammage ? (
          <div className="sa-tuile sa-tuile--icone">
            <span className="sa-tuile__icone">
              <Layers aria-hidden="true" />
            </span>
            <div>
              <p className="sa-tuile__libelle">Grammage</p>
              <p className="sa-tuile__valeur sa-tuile__valeur--grande">{grammage}</p>
            </div>
          </div>
        ) : (
          <p className="sa-vide">Grammage non précisé</p>
        )}
      </Section>
      <Section tone="rose" titre="Finitions">
        <Chips valeurs={finitions?.tags ?? []} vide="Aucune finition demandée" />
      </Section>
      <Section tone="purple" titre="Façonnage">
        <Chips valeurs={faconnage?.tags ?? []} vide="Aucun façonnage demandé" />
      </Section>
      <Section tone="indigo" titre="Options">
        <div className="sa-tuiles">
          <div className="sa-tuile" data-tone="slate">
            <p className="sa-tuile__libelle">Numérotation</p>
            {numerotation?.items.length ? (
              <div className="sa-tuiles" style={{ marginTop: 6 }}>
                <Tuile tone="slate" libelle="Début" valeur={item(numerotation, 'À partir de') || '—'} grande />
                <Tuile tone="slate" libelle="Nombre de chiffres" valeur={item(numerotation, 'Chiffres') || '—'} grande />
              </div>
            ) : (
              <p className="sa-tuile__valeur">Sans numérotation</p>
            )}
          </div>
          <div className="sa-tuile" data-tone="teal">
            <p className="sa-tuile__libelle">Conditionnement</p>
            <Chips tone="teal" petite valeurs={conditionnement?.tags ?? []} vide="Non précisé" />
          </div>
        </div>
      </Section>
      <Autres f={f} />
    </>
  );
}

function Roland({ f }: { f: FormulaireAncien }) {
  const support = section(f, 'support');
  const dims = section(f, 'dimensions');
  const quantite = section(f, 'quantite');
  const finitions = section(f, 'finition');
  const nomSupport = item(support, 'Support');
  const [largeur, hauteur] = dims?.grand ? dims.grand.valeur.split(' × ') : [];
  return (
    <>
      <Section tone="violet" titre="Support">
        {nomSupport ? (
          <div className="sa-tuile sa-tuile--icone">
            <span className="sa-tuile__icone">
              <FileText aria-hidden="true" />
            </span>
            <div>
              <p className="sa-tuile__libelle">Type de support</p>
              <p className="sa-tuile__valeur sa-tuile__valeur--grande">{nomSupport}</p>
            </div>
          </div>
        ) : (
          <p className="sa-vide">Support non précisé</p>
        )}
      </Section>
      <Section tone="cyan" titre="Dimensions">
        {dims?.grand && largeur && hauteur ? (
          <div className="sa-dims">
            <div className="sa-dims__ligne">
              <div className="sa-dims__cote">
                <small>Largeur</small>
                <strong className="ev-num">{largeur}</strong>
                <span>{dims.grand.unite}</span>
              </div>
              <span className="sa-dims__fois" aria-hidden="true">
                ×
              </span>
              <div className="sa-dims__cote">
                <small>Hauteur</small>
                <strong className="ev-num">{hauteur}</strong>
                <span>{dims.grand.unite}</span>
              </div>
            </div>
            <div className="sa-dims__pied">
              {dims.grand.detail && <Tuile tone="emerald" libelle="Surface" valeur={dims.grand.detail} />}
              <Tuile tone="emerald" libelle="Quantité" valeur={quantite?.grand ? `${quantite.grand.valeur} ex.` : 'Non précisée'} grande />
            </div>
          </div>
        ) : (
          <div className="sa-tuiles">
            <p className="sa-vide">Dimensions non précisées</p>
            <Tuile tone="emerald" libelle="Quantité" valeur={quantite?.grand ? `${quantite.grand.valeur} ex.` : 'Non précisée'} grande />
          </div>
        )}
      </Section>
      <Section tone="rose" titre="Finitions">
        {finitions?.items.length ? (
          <div className="sa-tuiles">
            {finitions.items.map(([k, v]) => (
              <Tuile key={k} libelle={k === 'Finition' ? 'Œillets' : k} valeur={v} />
            ))}
          </div>
        ) : (
          <p className="sa-vide">Aucune finition demandée</p>
        )}
      </Section>
      <Autres f={f} />
    </>
  );
}

/** Champs du formulaire d'origine que la fiche ne connaît pas : affichés tels quels, jamais perdus. */
function Autres({ f }: { f: FormulaireAncien }) {
  const s = section(f, 'autres');
  if (!s?.items.length) return null;
  return (
    <Section tone="slate" titre="Autres informations du formulaire">
      <div className="sa-tuiles">
        {s.items.map(([k, v]) => (
          <Tuile key={k} libelle={k} valeur={v} />
        ))}
      </div>
    </Section>
  );
}

/** Dossier importé sans formulaire reconnaissable : données brutes, lisibles. */
function DonneesBrutes({ legacy }: { legacy: unknown }) {
  const entrees = legacy && typeof legacy === 'object' && !Array.isArray(legacy) ? Object.entries(legacy as Record<string, unknown>) : [['Données', legacy] as const];
  const utiles = entrees.filter(([, v]) => !valeurVide(v));
  return (
    <div className="sa">
      <section className="sa-section" data-tone="slate">
        <h4 className="sa-section__titre">Données de l’ancienne plateforme</h4>
        {utiles.length ? (
          <div className="sa-tuiles">
            {utiles.map(([k, v]) => (
              <Tuile key={String(k)} libelle={cleLisible(String(k))} valeur={texteAncien(v)} />
            ))}
          </div>
        ) : (
          <p className="sa-vide">Aucune spécification n’avait été saisie. Voir la description et les fichiers.</p>
        )}
      </section>
    </div>
  );
}
