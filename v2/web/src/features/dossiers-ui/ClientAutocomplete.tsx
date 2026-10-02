// Champ « Client » avec autocomplétion sur l'annuaire (GET /clients/recherche).
// Si l'annuaire n'est pas disponible, le champ reste une saisie libre : le serveur
// retrouve ou crée le client à partir du nom.

import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2Off, UserRound } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import './dossiers-ui.css';

export interface ClientTrouve {
  id: number;
  nom: string;
  telephone: string | null;
  email: string | null;
}

function useDebounce<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function ClientAutocomplete({ nom, clientId, onNom, onSelect, erreur, autoFocus }: {
  nom: string;
  clientId: number | null;
  onNom: (nom: string) => void;
  onSelect: (c: ClientTrouve | null) => void;
  erreur?: string | null;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const [indisponible, setIndisponible] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const q = useDebounce(nom.trim(), 250);

  const recherche = useQuery({
    queryKey: ['clients', 'recherche', q],
    queryFn: async () => {
      try {
        return await api.get<ClientTrouve[]>('/clients/recherche', { q });
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
          setIndisponible(true);
          return [];
        }
        throw e;
      }
    },
    enabled: !indisponible && q.length >= 2 && clientId === null,
    staleTime: 30_000,
    retry: false,
  });
  const items = (recherche.data ?? []).slice(0, 8);
  const montrer = ouvert && !indisponible && clientId === null && q.length >= 2 && items.length > 0;

  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, []);
  useEffect(() => setActif(-1), [q]);

  const choisir = (c: ClientTrouve) => {
    onSelect(c);
    setOuvert(false);
  };

  return (
    <div className="ev-field du-combo" ref={boite}>
      <label className="ev-label" htmlFor={id}>
        Nom du client<span className="ev-req" aria-hidden="true">*</span>
      </label>
      <div className="du-combo__wrap">
        <input
          id={id}
          className="ev-input"
          value={nom}
          autoFocus={autoFocus}
          autoComplete="off"
          role={indisponible ? undefined : 'combobox'}
          aria-expanded={indisponible ? undefined : montrer}
          aria-controls={indisponible ? undefined : `${id}-liste`}
          aria-autocomplete={indisponible ? undefined : 'list'}
          aria-activedescendant={montrer && actif >= 0 ? `${id}-o${actif}` : undefined}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? `${id}-e` : `${id}-a`}
          aria-required
          placeholder="Entreprise ou particulier"
          onFocus={() => setOuvert(true)}
          onChange={(e) => {
            if (clientId !== null) onSelect(null);
            onNom(e.target.value);
            setOuvert(true);
          }}
          onKeyDown={(e) => {
            if (!montrer) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActif((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActif((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && actif >= 0 && items[actif]) {
              e.preventDefault();
              choisir(items[actif]!);
            } else if (e.key === 'Escape') {
              setOuvert(false);
            }
          }}
        />
        {montrer && (
          <ul className="du-combo__liste" role="listbox" id={`${id}-liste`} aria-label="Clients existants">
            {items.map((c, i) => (
              <li
                key={c.id}
                id={`${id}-o${i}`}
                role="option"
                aria-selected={i === actif}
                className="du-combo__option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choisir(c);
                }}
                onMouseEnter={() => setActif(i)}
              >
                <span className="du-combo__nom">{c.nom}</span>
                <span className="du-combo__meta ev-mono">{[c.telephone, c.email].filter(Boolean).join(' · ') || 'Sans coordonnées'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {erreur ? (
        <span className="ev-error" id={`${id}-e`} role="alert">
          {erreur}
        </span>
      ) : clientId !== null ? (
        <span className="ev-help du-combo__lie" id={`${id}-a`}>
          <UserRound size={14} aria-hidden="true" /> Client existant de l'annuaire
          <button type="button" className="ev-link du-combo__delier" onClick={() => onSelect(null)}>
            <Link2Off size={14} aria-hidden="true" /> Dissocier
          </button>
        </span>
      ) : (
        <span className="ev-help" id={`${id}-a`}>
          {indisponible ? 'Saisissez le nom : un client existant du même nom est retrouvé automatiquement.' : 'Tapez deux lettres pour retrouver un client existant.'}
        </span>
      )}
    </div>
  );
}
