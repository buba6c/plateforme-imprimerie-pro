import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: string | null;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
}

export function FieldShell({ label, required, help, error, children, className }: FieldShellProps) {
  const id = useId();
  const helpId = `${id}-aide`;
  const errId = `${id}-erreur`;
  const describedBy = error ? errId : help ? helpId : undefined;
  return (
    <div className={['ev-field', className].filter(Boolean).join(' ')}>
      <label className="ev-label" htmlFor={id}>
        {label}
        {required && <span className="ev-req" aria-hidden="true">*</span>}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {error ? (
        <span className="ev-error" id={errId} role="alert">
          {error}
        </span>
      ) : help ? (
        <span className="ev-help" id={helpId}>
          {help}
        </span>
      ) : null}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: ReactNode;
  help?: ReactNode;
  error?: string | null;
  addon?: ReactNode;
  mono?: boolean;
};

export function TextField({ label, help, error, required, addon, mono, className, ...rest }: InputProps) {
  return (
    <FieldShell label={label} help={help} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => {
        const input = (
          <input
            id={id}
            className={['ev-input', mono && 'ev-mono'].filter(Boolean).join(' ')}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            required={required}
            {...rest}
          />
        );
        return addon ? (
          <div className="ev-input-group">
            {input}
            <span className="ev-input-addon">{addon}</span>
          </div>
        ) : (
          input
        );
      }}
    </FieldShell>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: ReactNode;
  help?: ReactNode;
  error?: string | null;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
};

export function SelectField({ label, help, error, required, options, placeholder, className, ...rest }: SelectProps) {
  return (
    <FieldShell label={label} help={help} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <select id={id} className="ev-select" aria-invalid={invalid || undefined} aria-describedby={describedBy} required={required} {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: ReactNode;
  help?: ReactNode;
  error?: string | null;
};

export function TextareaField({ label, help, error, required, className, ...rest }: TextareaProps) {
  return (
    <FieldShell label={label} help={help} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} className="ev-textarea" aria-invalid={invalid || undefined} aria-describedby={describedBy} required={required} {...rest} />
      )}
    </FieldShell>
  );
}

export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="ev-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ev-check__box" aria-hidden="true" />
      {label}
    </label>
  );
}

export function Segmented<T extends string>({
  name,
  value,
  onChange,
  options,
  label,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; help?: string; icon?: React.ReactNode }[];
  label: string;
}) {
  return (
    <div className="ev-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.value}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span data-icone={o.icon ? true : undefined}>
            {o.icon && <span className="ev-segmented__icone">{o.icon}</span>}
            <span className="ev-segmented__texte">
              {o.label}
              {o.help && <small>{o.help}</small>}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
