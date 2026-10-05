// Outils communs aux sections : brouillon du formulaire, contrôles locaux, barre d'enregistrement.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { messageErreur } from '../../lib/api';
import { Alert, Button, useToast } from '../../ui';
import { champsErreur } from '../admin/hooks';
import { useEnregistrerParametres } from './api';
import type { ParametresAdmin } from './types';

/** Nombre saisi à la française (espaces, virgule décimale) ; null si vide ou illisible. */
export function nombre(v: string): number | null {
  const s = v.replace(/[\s  ]/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Entier entre min et max, ou message d'erreur. */
export function entier(v: string, min: number, max: number, unite: string): number | string {
  const n = nombre(v);
  if (n === null || !Number.isInteger(n) || n < min || n > max) return `Nombre entier ${unite ? `de ${unite} ` : ''}entre ${min} et ${max}.`;
  return n;
}

/**
 * Brouillon d'un formulaire construit à partir des données du serveur. Il repart des données
 * enregistrées quand celles-ci changent (enregistrement, import).
 */
export function useBrouillon<F>(depuis: () => F, deps: unknown[]) {
  const initial = useMemo(depuis, deps);
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial), [initial]);
  const modifie = JSON.stringify(f) !== JSON.stringify(initial);
  return { f, setF, modifie, annuler: () => setF(initial) };
}

/**
 * Formulaire d'une section : contrôle local, envoi, erreurs par champ de l'API, barre d'enregistrement.
 * `verifier` renvoie soit des erreurs (clé = chemin du champ, comme l'API), soit le corps à envoyer.
 */
export function SectionForm({
  titre,
  modifie,
  verifier,
  annuler,
  onErreurs,
  children,
  libelleBouton = 'Enregistrer',
}: {
  titre: string;
  modifie: boolean;
  verifier: () => { erreurs: Record<string, string> } | { body: Partial<ParametresAdmin> };
  annuler: () => void;
  onErreurs: (e: Record<string, string>) => void;
  children: ReactNode;
  libelleBouton?: string;
}) {
  const m = useEnregistrerParametres();
  const toast = useToast();
  const [erreur, setErreur] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = verifier();
    if ('erreurs' in v) {
      onErreurs(v.erreurs);
      setErreur('Certains champs sont invalides : corrigez-les puis enregistrez de nouveau.');
      return;
    }
    onErreurs({});
    setErreur(null);
    m.mutate(v.body, {
      onSuccess: () => toast.success(`${titre} : enregistré`, 'Les nouveaux réglages s’appliquent dès maintenant.'),
      onError: (err) => {
        const c = champsErreur(err);
        onErreurs(c);
        setErreur(Object.keys(c).length ? `Enregistrement refusé : ${Object.values(c).join(' ; ')}.` : messageErreur(err));
      },
    });
  };

  return (
    <form className="stack-lg" onSubmit={submit} noValidate>
      {erreur && <Alert tone="error">{erreur}</Alert>}
      {children}
      <div className={modifie ? 'adm-savebar adm-savebar--sticky' : 'adm-savebar'}>
        <span className="ev-muted" style={{ fontSize: 13 }}>
          {modifie ? 'Modifications non enregistrées' : 'Tout est enregistré'}
        </span>
        <Button
          icon={<Undo2 />}
          disabled={!modifie || m.isPending}
          onClick={() => {
            annuler();
            onErreurs({});
            setErreur(null);
          }}
        >
          Annuler<span className="prm-cache-mobile"> les modifications</span>
        </Button>
        <Button type="submit" variant="primary" icon={<Save />} busy={m.isPending} disabled={!modifie}>
          {libelleBouton}
        </Button>
      </div>
    </form>
  );
}

export interface SectionProps {
  p: ParametresAdmin;
  /** Signale au menu que la section a des modifications non enregistrées. */
  onModifie: (modifie: boolean) => void;
}

/** Remonte l'état « modifié » au menu des sections. */
export function useSignalerModifie(modifie: boolean, onModifie: (m: boolean) => void) {
  useEffect(() => onModifie(modifie), [modifie, onModifie]);
}
