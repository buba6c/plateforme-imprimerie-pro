import { useEffect, useState } from 'react';
import { Card, Checkbox, Segmented } from '../../ui';
import {
  abonnerApparence,
  changerPreferences,
  getApparence,
  getPreferences,
  type Palette,
  type Theme,
} from '../../lib/theme';
import { PaletteCartes, NOMS_PALETTES } from './PaletteCartes';

/** Apparence choisie par l'utilisateur connecté : mode, palette, contraste. */
export function ChoixApparence() {
  const [prefs, setPrefs] = useState(getPreferences());
  const [apparence, setApparence] = useState(getApparence());
  useEffect(
    () =>
      abonnerApparence(() => {
        setPrefs(getPreferences());
        setApparence(getApparence());
      }),
    [],
  );

  const disponibles: Palette[] = apparence.couleurs_perso ? ['evocom', 'sobre', 'perso'] : ['evocom', 'sobre'];
  return (
    <Card title="Apparence">
      <div className="stack">
        <div className="stack-sm">
          <span className="ev-label-text">Mode</span>
          <Segmented<Theme>
            name="mode"
            label="Mode d'affichage"
            value={prefs.theme}
            onChange={(theme) => void changerPreferences({ theme })}
            options={[
              { value: 'system', label: 'Automatique' },
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
            ]}
          />
        </div>
        <div className="stack-sm">
          <span className="ev-label-text">Couleurs</span>
          <PaletteCartes
            name="palette"
            valeur={prefs.palette}
            onChange={(palette) => void changerPreferences({ palette })}
            palettes={disponibles}
            couleursPerso={apparence.couleurs_perso}
            optionEntreprise={`Celles de l'entreprise (${NOMS_PALETTES[apparence.palette_defaut]})`}
          />
        </div>
        <Checkbox
          label="Contraste renforcé : texte plus foncé et bordures marquées"
          checked={prefs.contraste === 'eleve'}
          onChange={(v) => void changerPreferences({ contraste: v ? 'eleve' : 'normal' })}
        />
      </div>
    </Card>
  );
}
