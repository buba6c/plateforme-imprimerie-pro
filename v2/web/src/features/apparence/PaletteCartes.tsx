import type { Palette } from '../../lib/theme';

export const NOMS_PALETTES: Record<Palette, string> = {
  evocom: 'Evocom, en dégradé',
  sobre: 'Clair sobre',
  perso: 'Personnalisée',
};

const AIDES: Record<Palette, string> = {
  evocom: 'Menu bleu en dégradé, boutons en dégradé Evocom.',
  sobre: 'Menu clair, couleurs en aplat.',
  perso: "Les deux couleurs choisies par l'administrateur.",
};

function Apercu({ palette, couleurs }: { palette: Palette | null; couleurs: { debut: string; fin: string } | null }) {
  const debut = palette === 'perso' && couleurs ? couleurs.debut : '#007bff';
  const fin = palette === 'perso' && couleurs ? couleurs.fin : '#00c6ff';
  const menu = palette === 'sobre' ? 'var(--surface)' : `linear-gradient(180deg, ${debut}, ${fin})`;
  return (
    <span className="palette-apercu" aria-hidden="true">
      <span className="palette-apercu__menu" style={{ background: menu }} />
      <span className="palette-apercu__page">
        <span className="palette-apercu__ligne" />
        <span className="palette-apercu__bouton" style={{ background: palette === 'sobre' ? debut : `linear-gradient(135deg, ${debut}, ${fin})` }} />
      </span>
    </span>
  );
}

/** Choix de palette sous forme de cartes avec aperçu. valeur null = option « celle de l'entreprise ». */
export function PaletteCartes({
  name,
  valeur,
  onChange,
  palettes,
  couleursPerso,
  optionEntreprise,
}: {
  name: string;
  valeur: Palette | null;
  onChange: (p: Palette | null) => void;
  palettes: Palette[];
  couleursPerso: { debut: string; fin: string } | null;
  optionEntreprise?: string;
}) {
  const options: (Palette | null)[] = optionEntreprise ? [null, ...palettes] : palettes;
  return (
    <div className="palette-cartes" role="radiogroup" aria-label="Couleurs">
      {options.map((p) => (
        <label key={p ?? 'entreprise'} className="palette-carte">
          <input type="radio" name={name} checked={valeur === p} onChange={() => onChange(p)} />
          <span className="palette-carte__corps">
            {p ? <Apercu palette={p} couleurs={couleursPerso} /> : <span className="palette-apercu palette-apercu--entreprise" aria-hidden="true">Auto</span>}
            <span className="palette-carte__texte">
              <strong>{p ? NOMS_PALETTES[p] : optionEntreprise}</strong>
              <small>{p ? AIDES[p] : "Suit le choix fait pour toute l'équipe."}</small>
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
