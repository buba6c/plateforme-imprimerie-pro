import { useState } from 'react';
import { Card, TextField } from '../../../ui';
import { entier, nombre, SectionForm, useBrouillon, useSignalerModifie, type SectionProps } from '../form';

const BORNES = {
  session_heures: [1, 720, 'heures'],
  echecs_avant_blocage: [3, 20, ''],
  blocage_minutes: [1, 1440, 'minutes'],
  mdp_longueur_min: [8, 64, 'caractères'],
} as const;
type Cle = keyof typeof BORNES;

function duree(heures: number): string {
  if (heures % 24 === 0) return `${heures / 24} jour${heures / 24 > 1 ? 's' : ''}`;
  return `${heures} heure${heures > 1 ? 's' : ''}`;
}

export function SectionSecurite({ p, onModifie }: SectionProps) {
  const { f, setF, modifie, annuler } = useBrouillon(
    () => Object.fromEntries(Object.keys(BORNES).map((k) => [k, String(p.securite[k as Cle])])) as Record<Cle, string>,
    [p.securite],
  );
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  useSignalerModifie(modifie, onModifie);
  const set = (k: Cle, v: string) => setF({ ...f, [k]: v });

  const verifier = () => {
    const e: Record<string, string> = {};
    const valeurs = {} as Record<Cle, number>;
    for (const k of Object.keys(BORNES) as Cle[]) {
      const [min, max, unite] = BORNES[k];
      const v = entier(f[k], min, max, unite);
      if (typeof v === 'string') e[`securite.${k}`] = v;
      else valeurs[k] = v;
    }
    if (Object.keys(e).length) return { erreurs: e };
    return { body: { securite: valeurs } };
  };

  const echecs = nombre(f.echecs_avant_blocage);
  const blocage = nombre(f.blocage_minutes);
  const session = nombre(f.session_heures);

  return (
    <SectionForm titre="Sécurité" modifie={modifie} verifier={verifier} annuler={annuler} onErreurs={setErreurs}>
      <Card title="Connexion">
        <div className="stack">
          <div className="ev-form-grid">
            <TextField
              label="Durée d’une session"
              inputMode="numeric"
              mono
              addon="heures"
              value={f.session_heures}
              onChange={(e) => set('session_heures', e.target.value)}
              error={erreurs['securite.session_heures']}
              help="Temps avant de devoir se reconnecter (1 à 720 h). S’applique aux connexions suivantes ; les sessions ouvertes gardent leur durée."
            />
            <TextField
              label="Essais avant blocage"
              inputMode="numeric"
              mono
              addon="essais"
              value={f.echecs_avant_blocage}
              onChange={(e) => set('echecs_avant_blocage', e.target.value)}
              error={erreurs['securite.echecs_avant_blocage']}
              help="Mots de passe faux à la suite avant de bloquer le compte (3 à 20)."
            />
            <TextField
              label="Durée du blocage"
              inputMode="numeric"
              mono
              addon="minutes"
              value={f.blocage_minutes}
              onChange={(e) => set('blocage_minutes', e.target.value)}
              error={erreurs['securite.blocage_minutes']}
              help="Un administrateur peut débloquer avant en réinitialisant le mot de passe (1 à 1 440 min)."
            />
          </div>
          {session !== null && session >= 1 && echecs !== null && echecs >= 1 && blocage !== null && blocage >= 1 && (
            <div className="adm-example" aria-live="polite">
              <strong>En pratique</strong>
              <br />
              Une connexion reste valable {duree(session)}. Après {echecs} mots de passe faux à la suite, le compte est bloqué {blocage} minute
              {blocage > 1 ? 's' : ''}.
            </div>
          )}
        </div>
      </Card>
      <Card title="Mots de passe">
        <TextField
          label="Longueur minimale"
          inputMode="numeric"
          mono
          addon="caractères"
          value={f.mdp_longueur_min}
          onChange={(e) => set('mdp_longueur_min', e.target.value)}
          error={erreurs['securite.mdp_longueur_min']}
          help="Exigée à la création d’un compte, à chaque changement de mot de passe et pour les mots de passe provisoires (8 à 64). Les mots de passe actuels restent valables."
        />
      </Card>
    </SectionForm>
  );
}
