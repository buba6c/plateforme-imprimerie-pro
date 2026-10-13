import { describe, expect, it } from 'vitest';
import { nombreEnLettres } from '../src/format';

describe('nombreEnLettres', () => {
  it('écrit les montants des devis en toutes lettres', () => {
    expect(nombreEnLettres(0)).toBe('zéro');
    expect(nombreEnLettres(1)).toBe('un');
    expect(nombreEnLettres(21)).toBe('vingt et un');
    expect(nombreEnLettres(71)).toBe('soixante et onze');
    expect(nombreEnLettres(80)).toBe('quatre-vingts');
    expect(nombreEnLettres(81)).toBe('quatre-vingt-un');
    expect(nombreEnLettres(91)).toBe('quatre-vingt-onze');
    expect(nombreEnLettres(100)).toBe('cent');
    expect(nombreEnLettres(200)).toBe('deux cents');
    expect(nombreEnLettres(201)).toBe('deux cent un');
    expect(nombreEnLettres(1000)).toBe('mille');
    expect(nombreEnLettres(35000)).toBe('trente-cinq mille');
    expect(nombreEnLettres(80000)).toBe('quatre-vingt mille');
    expect(nombreEnLettres(200000)).toBe('deux cent mille');
    expect(nombreEnLettres(1_105_000)).toBe('un million cent cinq mille');
    expect(nombreEnLettres(2_000_000)).toBe('deux millions');
    expect(nombreEnLettres(1_234_567)).toBe('un million deux cent trente-quatre mille cinq cent soixante-sept');
  });
});
