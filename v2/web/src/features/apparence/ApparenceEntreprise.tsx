import { useEffect, useState } from 'react';
import { api, messageErreur } from '../../lib/api';
import { contraste, paletteDerivee } from '../../lib/couleurs';
import { definirApparence, getApparence, rafraichirApparence, type Apparence, type Palette } from '../../lib/theme';
import { Alert, Button, Card, useToast } from '../../ui';
import { PaletteCartes } from './PaletteCartes';

const EVOCOM = { debut: '#33b5e5', fin: '#e91e8c' };
const HEX = /^#[0-9a-f]{6}$/i;

function ChampCouleur({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [texte, setTexte] = useState(value);
  useEffect(() => setTexte(value), [value]);
  const id = `couleur-${label}`;
  return (
    <div className="ev-field">
      <label className="ev-label" htmlFor={id}>{label}</label>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="color" aria-label={`${label} (sélecteur)`} value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="couleur-pastille" />
        <input
          id={id}
          className="ev-input ev-mono"
          value={texte}
          maxLength={7}
          onChange={(e) => {
            setTexte(e.target.value);
            if (HEX.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
        />
      </div>
    </div>
  );
}

/** Couleurs de l'entreprise : palette proposée à toute l'équipe et couleurs personnalisées (admin). */
export function ApparenceEntreprise({ onModifie }: { onModifie?: (modifie: boolean) => void }) {
  const toast = useToast();
  const [initiale, setInitiale] = useState<Apparence>(getApparence());
  const [palette, setPalette] = useState<Palette>(initiale.palette_defaut);
  const [couleurs, setCouleurs] = useState(initiale.couleurs_perso ?? EVOCOM);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const brouillon: Apparence = { palette_defaut: palette, couleurs_perso: palette === 'perso' || initiale.couleurs_perso ? couleurs : null };
  const modifie = JSON.stringify(brouillon) !== JSON.stringify(initiale);
  useEffect(() => onModifie?.(modifie), [modifie, onModifie]);
  const derivee = paletteDerivee(couleurs.debut, couleurs.fin, 'light');
  const ajuste = derivee['--accent'] !== couleurs.debut;
  const texteDegrade = Math.min(contraste(derivee['--on-brand']!, derivee['--brand-start']!), contraste(derivee['--on-brand']!, derivee['--brand-end']!));

  // Aperçu en direct ; on revient à l'apparence enregistrée en quittant l'écran sans enregistrer.
  useEffect(() => {
    definirApparence(brouillon);
  }, [palette, couleurs.debut, couleurs.fin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => void rafraichirApparence(), []);

  return (
    <Card title="Couleurs de l'entreprise">
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setErreur(null);
          setBusy(true);
          try {
            const a = await api.put<Apparence>('/apparence', brouillon);
            definirApparence(a);
            setInitiale(a);
            toast.success('Couleurs enregistrées', "Elles s'appliquent à toute l'équipe, sauf à ceux qui ont choisi leurs propres couleurs.");
          } catch (err) {
            setErreur(messageErreur(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="ev-muted" style={{ margin: 0 }}>
          Palette affichée par défaut pour toute l'équipe, y compris sur l'écran de connexion. Chacun peut ensuite choisir la sienne dans « Mon compte ».
        </p>
        {erreur && <Alert tone="error">{erreur}</Alert>}
        <PaletteCartes name="palette-entreprise" valeur={palette} onChange={(p) => setPalette(p ?? 'evocom')} palettes={['evocom', 'sobre', 'perso']} couleursPerso={couleurs} />
        {palette === 'perso' && (
          <div className="stack-sm">
            <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
              <ChampCouleur label="Début du dégradé" value={couleurs.debut} onChange={(debut) => setCouleurs((c) => ({ ...c, debut }))} />
              <ChampCouleur label="Fin du dégradé" value={couleurs.fin} onChange={(fin) => setCouleurs((c) => ({ ...c, fin }))} />
            </div>
            <div className="couleur-bandeau" style={{ background: `linear-gradient(135deg, ${derivee['--brand-start']}, ${derivee['--brand-end']})`, color: derivee['--on-brand'] }}>
              Dégradé de marque · texte {texteDegrade.toFixed(1).replace('.', ',')}:1
            </div>
            <div className="row">
              <span className="ev-btn ev-btn--primary" aria-hidden="true" style={{ background: `linear-gradient(135deg, ${derivee['--accent']}, ${derivee['--accent-end']})` }}>
                Bouton principal
              </span>
              <span className="ev-muted" style={{ fontSize: 13 }}>
                {ajuste
                  ? 'Pour que le texte reste lisible, les boutons et le menu utilisent une version plus foncée de vos couleurs.'
                  : 'Vos couleurs sont assez foncées pour porter du texte blanc telles quelles.'}
              </span>
            </div>
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCouleurs(EVOCOM)}>
                Revenir au dégradé Evocom
              </Button>
            </div>
          </div>
        )}
        <div>
          <Button type="submit" variant="primary" busy={busy}>
            Enregistrer pour toute l'équipe
          </Button>
        </div>
      </form>
    </Card>
  );
}
