import { useEffect, useRef, useState } from 'react';

const DUREE_SURBRILLANCE = 10_000;

/**
 * Repère les dossiers qui arrivent dans « Prêt à imprimer » pendant que la page est ouverte.
 * Un dossier remis en attente par l'imprimeur (il était déjà en impression) n'est pas « nouveau ».
 * `cle` change quand la file change (machine) : on repart alors de zéro, sans signal.
 */
export function useArrivees(
  prets: number[] | undefined,
  actifs: number[] | undefined,
  cle: string,
  onArrivee: (n: number) => void,
): Set<number> {
  const connus = useRef<{ cle: string; ids: Set<number> } | null>(null);
  const minuteries = useRef(new Set<number>());
  const [nouveaux, setNouveaux] = useState<Set<number>>(() => new Set());
  const rappel = useRef(onArrivee);
  rappel.current = onArrivee;
  const signature = prets && actifs ? `${prets.join(',')}|${actifs.join(',')}` : null;

  useEffect(() => {
    const t = minuteries.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    if (!prets || !actifs) return;
    const courants = new Set([...prets, ...actifs]);
    if (!connus.current || connus.current.cle !== cle) {
      connus.current = { cle, ids: courants };
      setNouveaux(new Set());
      return;
    }
    const precedents = connus.current.ids;
    const arrives = prets.filter((id) => !precedents.has(id));
    connus.current.ids = courants;
    if (!arrives.length) return;
    setNouveaux((s) => new Set([...s, ...arrives]));
    rappel.current(arrives.length);
    const t = window.setTimeout(() => {
      minuteries.current.delete(t);
      setNouveaux((s) => {
        const n = new Set(s);
        arrives.forEach((id) => n.delete(id));
        return n;
      });
    }, DUREE_SURBRILLANCE);
    minuteries.current.add(t);
    // La signature résume les deux listes : inutile de dépendre des tableaux eux-mêmes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, cle]);

  return nouveaux;
}
