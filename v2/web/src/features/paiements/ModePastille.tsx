// Mode de paiement : logo officiel (Wave, Orange Money) ou pictogramme (espèces, virement, chèque,
// carte), en pastille, en icône seule, ou en choix cliquable dans un formulaire.
import { Banknote, CreditCard, Landmark, ScrollText, type LucideIcon } from 'lucide-react';
import { MODE_PAIEMENT_LABELS, MODES_PAIEMENT, type ModePaiement } from '@evocom/shared';
import './paiements.css';

/** Logos officiels, servis depuis /marque/paiement (wave.com ; Orange Money, domaine public). */
const LOGOS: Partial<Record<ModePaiement, { src: string; alt: string }>> = {
  wave: { src: '/marque/paiement/wave.png', alt: 'Wave' },
  orange_money: { src: '/marque/paiement/orange-money.svg', alt: 'Orange Money' },
};

const PICTOS: Partial<Record<ModePaiement, LucideIcon>> = {
  especes: Banknote,
  virement: Landmark,
  cheque: ScrollText,
  carte: CreditCard,
};

/** L'icône seule (logo ou pictogramme), à la taille demandée en pixels. */
export function ModeIcone({ mode, taille = 18 }: { mode: ModePaiement; taille?: number }) {
  const logo = LOGOS[mode];
  if (logo) return <img className="pay-logo" src={logo.src} alt="" width={taille} height={taille} style={{ width: taille, height: taille }} draggable={false} />;
  const Picto = PICTOS[mode] ?? Banknote;
  return (
    <span className="pay-picto" style={{ width: taille, height: taille }} aria-hidden="true">
      <Picto />
    </span>
  );
}

/** Pastille du mode de paiement (Espèces, Wave, Orange Money…) : logo + libellé. */
export function ModePastille({ mode, taille = 'md' }: { mode: ModePaiement; taille?: 'sm' | 'md' }) {
  return (
    <span className="pay-mode" data-mode={mode} data-taille={taille}>
      <ModeIcone mode={mode} taille={taille === 'sm' ? 14 : 18} />
      {MODE_PAIEMENT_LABELS[mode] ?? mode}
    </span>
  );
}

/** Choix du mode de paiement dans un formulaire : une tuile par mode, avec son logo. */
export function ModeChoix({ value, onChange, label = 'Mode de paiement', name = 'mode-paiement' }: { value: ModePaiement; onChange: (m: ModePaiement) => void; label?: string; name?: string }) {
  return (
    <fieldset className="pay-choix">
      <legend className="ev-label">{label}</legend>
      <div className="pay-choix__liste" role="radiogroup" aria-label={label}>
        {MODES_PAIEMENT.map((m) => (
          <label key={m} className="pay-choix__tuile" data-mode={m} data-on={value === m || undefined}>
            <input type="radio" name={name} value={m} checked={value === m} onChange={() => onChange(m)} />
            <ModeIcone mode={m} taille={30} />
            <span>{MODE_PAIEMENT_LABELS[m]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
