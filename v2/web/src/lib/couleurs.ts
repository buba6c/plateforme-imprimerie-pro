// Calculs de contraste (WCAG 2.1) et dérivation d'une palette lisible à partir de deux couleurs de marque.

type Rgb = [number, number, number];

export function hexVersRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

export function rgbVersHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

function luminance(hex: string): number {
  const [r, g, b] = hexVersRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Mélange linéaire : part = proportion de la couleur b. */
export function melanger(a: string, b: string, part: number): string {
  const ca = hexVersRgb(a);
  const cb = hexVersRgb(b);
  return rgbVersHex(ca.map((v, i) => v + (cb[i]! - v) * part) as Rgb);
}

/** Rapproche la couleur du noir (ou du blanc) par petits pas jusqu'à satisfaire la condition. */
function ajuster(hex: string, vers: '#000000' | '#ffffff', ok: (c: string) => boolean): string {
  for (let i = 0; i <= 40; i++) {
    const c = melanger(hex, vers, i * 0.025);
    if (ok(c)) return c;
  }
  return vers;
}

const BLANC = '#ffffff';
const NUIT = '#06121f';
const SURFACE_SOMBRE = '#121b25';

/** Variables CSS d'une palette personnalisée, pour le mode donné. Chaque texte atteint 4,5:1. */
export function paletteDerivee(debut: string, fin: string, mode: 'light' | 'dark'): Record<string, string> {
  const meilleurTexte = [NUIT, BLANC]
    .map((t) => ({ t, min: Math.min(contraste(t, debut), contraste(t, fin)) }))
    .sort((a, b) => b.min - a.min)[0]!;
  let brandStart = debut;
  let brandEnd = fin;
  let onBrand = meilleurTexte.t;
  if (meilleurTexte.min < 4.5) {
    // Aucun texte n'est lisible sur tout le dégradé : on l'assombrit pour porter du blanc.
    brandStart = ajuster(debut, '#000000', (c) => contraste(BLANC, c) >= 4.6);
    brandEnd = ajuster(fin, '#000000', (c) => contraste(BLANC, c) >= 4.6);
    onBrand = BLANC;
  }
  const v: Record<string, string> = { '--brand-start': brandStart, '--brand-end': brandEnd, '--on-brand': onBrand };

  if (mode === 'light') {
    const accent = ajuster(debut, '#000000', (c) => contraste(BLANC, c) >= 4.6);
    const soft = melanger(debut, BLANC, 0.9);
    const navMuted = '#e6f3ff';
    const navStart = ajuster(debut, '#000000', (c) => contraste(BLANC, c) >= 5.2 && contraste(navMuted, c) >= 4.6);
    Object.assign(v, {
      '--accent': accent,
      '--accent-end': ajuster(fin, '#000000', (c) => contraste(BLANC, c) >= 4.6),
      '--on-accent': BLANC,
      '--accent-soft': soft,
      '--accent-ink': ajuster(debut, '#000000', (c) => contraste(c, BLANC) >= 6 && contraste(c, soft) >= 4.8),
      '--nav-start': navStart,
      '--nav-end': ajuster(fin, '#000000', (c) => contraste(BLANC, c) >= 5 && contraste(navMuted, c) >= 4.6),
      '--nav-muted': navMuted,
      '--nav-active-bg': BLANC,
      '--nav-active-bg-end': BLANC,
      '--nav-active-text': navStart,
      '--focus-ring': `0 0 0 2px ${BLANC}, 0 0 0 4px ${accent}`,
    });
  } else {
    const accent = ajuster(debut, '#ffffff', (c) => contraste(NUIT, c) >= 6);
    const actifDebut = contraste(NUIT, debut) >= 4.6 ? debut : accent;
    const actifFin = contraste(NUIT, fin) >= 4.6 ? fin : ajuster(fin, '#ffffff', (c) => contraste(NUIT, c) >= 4.6);
    Object.assign(v, {
      '--accent': accent,
      '--accent-end': ajuster(fin, '#ffffff', (c) => contraste(NUIT, c) >= 6),
      '--on-accent': NUIT,
      '--accent-soft': melanger(SURFACE_SOMBRE, debut, 0.22),
      '--accent-ink': ajuster(debut, '#ffffff', (c) => contraste(c, SURFACE_SOMBRE) >= 7),
      '--nav-active-bg': actifDebut,
      '--nav-active-bg-end': actifFin,
      '--nav-active-text': NUIT,
      '--focus-ring': `0 0 0 2px ${SURFACE_SOMBRE}, 0 0 0 4px ${accent}`,
    });
  }
  return v;
}
