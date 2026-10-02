// Signal sonore discret pour l'arrivée d'un nouveau dossier dans la file d'impression.
// Les navigateurs bloquent le son tant que la personne n'a pas interagi avec la page :
// le son n'est joué qu'après activation explicite (bouton), et le contexte audio est
// réveillé au premier geste si la préférence a été gardée d'une visite précédente.

import { useCallback, useEffect, useState } from 'react';

const CLE = 'evocom.atelier.son';
let ctx: AudioContext | null = null;

function contexte(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

function lirePreference(): boolean {
  try {
    return localStorage.getItem(CLE) === '1';
  } catch {
    return false;
  }
}

function ecrirePreference(v: boolean) {
  try {
    if (v) localStorage.setItem(CLE, '1');
    else localStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible : la préférence ne sera simplement pas gardée */
  }
}

/** Deux notes courtes, volume modéré. */
export function jouerCarillon() {
  const c = ctx;
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime + 0.02;
  for (const [freq, dt] of [
    [880, 0],
    [660, 0.2],
  ] as const) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.45);
    o.connect(g).connect(c.destination);
    o.start(t0 + dt);
    o.stop(t0 + dt + 0.5);
  }
}

export type EtatSon = 'off' | 'on' | 'bloque' | 'indisponible';

export function useSonAtelier() {
  const [etat, setEtat] = useState<EtatSon>(() => (lirePreference() ? 'bloque' : 'off'));

  // Préférence gardée : on tente de réveiller le contexte, sinon au premier geste.
  useEffect(() => {
    if (etat !== 'bloque') return;
    const c = contexte();
    if (!c) {
      setEtat('indisponible');
      return;
    }
    if (c.state === 'running') {
      setEtat('on');
      return;
    }
    const reveiller = () => {
      void c.resume().then(() => {
        if (c.state === 'running') setEtat('on');
      });
    };
    document.addEventListener('pointerdown', reveiller, { once: true });
    document.addEventListener('keydown', reveiller, { once: true });
    return () => {
      document.removeEventListener('pointerdown', reveiller);
      document.removeEventListener('keydown', reveiller);
    };
  }, [etat]);

  const basculer = useCallback(async () => {
    if (etat === 'on') {
      ecrirePreference(false);
      setEtat('off');
      return;
    }
    const c = contexte();
    if (!c) {
      setEtat('indisponible');
      return;
    }
    await c.resume().catch(() => {});
    ecrirePreference(true);
    if (c.state === 'running') {
      setEtat('on');
      jouerCarillon();
    } else setEtat('bloque');
  }, [etat]);

  return { etat, basculer };
}
