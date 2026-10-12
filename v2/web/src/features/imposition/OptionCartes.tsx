// Sélecteur d'options illustrées : chaque choix a un pictogramme, un titre, une aide, et une couleur
// de sélection (la même famille de couleur par groupe : fonds perdus, poses, orientation…).
import type { ReactNode } from 'react';

export interface OptionCarte<T extends string> {
  value: T;
  label: string;
  aide?: string;
  picto: ReactNode;
}

export function OptionCartes<T extends string>({ name, label, value, onChange, options, tone = 'accent', compact }: { name: string; label: string; value: T; onChange: (v: T) => void; options: OptionCarte<T>[]; tone?: 'accent' | 'violet' | 'teal' | 'orange' | 'rose'; compact?: boolean }) {
  return (
    <fieldset className="opt" data-tone={tone} data-compact={compact || undefined}>
      <legend className="opt__legende">{label}</legend>
      <div className="opt__liste" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <label key={o.value} className="opt__carte" data-actif={o.value === value || undefined} title={o.aide}>
            <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} className="sr-only" />
            <span className="opt__picto">{o.picto}</span>
            <span className="opt__label">{o.label}</span>
            {!compact && o.aide && <span className="opt__aide">{o.aide}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
