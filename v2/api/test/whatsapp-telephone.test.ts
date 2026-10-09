import { describe, expect, it } from 'vitest';
import { estDemandeStop, normaliserTelephone, telephoneDepuisJid } from '../src/modules/whatsapp/telephone';
import { dateLisible, rendreModele, VARIABLES_EXEMPLE } from '../src/modules/whatsapp/modeles';
import { fusionnerParametresWhatsApp, PARAMETRES_WHATSAPP_DEFAUT, parametresWhatsAppSchema } from '../src/modules/whatsapp/parametres';
import { dansLesHeures } from '../src/modules/whatsapp/file';

describe('normalisation des numéros', () => {
  it.each([
    ['77 123 45 67', '+221771234567'],
    ['771234567', '+221771234567'],
    ['+221 77 123 45 67', '+221771234567'],
    ['00221771234567', '+221771234567'],
    ['221771234567', '+221771234567'],
    ['77-123-45-67', '+221771234567'],
    ['(77) 123.45.67', '+221771234567'],
    ['70 000 00 00', '+221700000000'],
    [' 78 999 88 77 / 77 111 22 33 ', '+221789998877'],
    ['+33 6 12 34 56 78', '+33612345678'],
    ['0033612345678', '+33612345678'],
    ['+212612345678', '+212612345678'],
  ])('%s → %s', (brut, attendu) => {
    const t = normaliserTelephone(brut);
    expect(t?.e164).toBe(attendu);
    expect(t?.jid).toBe(`${attendu.slice(1)}@s.whatsapp.net`);
  });

  it('présente les numéros sénégalais par groupes', () => {
    expect(normaliserTelephone('771234567')?.affichage).toBe('+221 77 123 45 67');
    expect(normaliserTelephone('+33612345678')?.affichage).toBe('+33612345678');
  });

  it.each(['', '   ', null, undefined, 'abc', '12', '33 821 12 34', '+221 33 821 12 34', '0612345678', '612345678', '+2217712345', '+221771234567890', '+0123456789', '77 123 45 6x'])(
    'refuse %s',
    (brut) => {
      expect(normaliserTelephone(brut as string)).toBeNull();
    },
  );

  it('relit un numéro depuis un identifiant WhatsApp', () => {
    expect(telephoneDepuisJid('221771234567@s.whatsapp.net')).toBe('+221771234567');
    expect(telephoneDepuisJid('221771234567:12@s.whatsapp.net')).toBe('+221771234567');
    expect(telephoneDepuisJid('123456789-1234@g.us')).toBeNull();
    expect(telephoneDepuisJid('status@broadcast')).toBeNull();
  });
});

describe('demande STOP', () => {
  it.each(['STOP', 'stop', ' Stop svp ', 'ARRET', 'Arrêt', 'arrêter les messages', 'ARRETEZ'])('%s est une demande STOP', (t) => {
    expect(estDemandeStop(t)).toBe(true);
  });
  it.each(['Merci', 'Je passe demain', 'stopper', "C'est stop ?", 'non stop'])('%s n’en est pas une', (t) => {
    expect(estDemandeStop(t)).toBe(false);
  });
});

describe('modèles', () => {
  it('remplace les variables et ajoute la signature', () => {
    const texte = rendreModele('Bonjour {client}, commande {numero} ({travail}) : {montant}. {inconnu}', VARIABLES_EXEMPLE, 'L’équipe Evocom');
    expect(texte).toBe('Bonjour Awa Diop, commande CMD-2026-0042 (Bâche standard · 300 × 200 cm · 1 ex.) : 45 000 FCFA. {inconnu}\nL’équipe Evocom');
  });

  it('nettoie une adresse vide', () => {
    const texte = rendreModele(PARAMETRES_WHATSAPP_DEFAUT.modeles.pret_retrait, { ...VARIABLES_EXEMPLE, adresse: '' });
    expect(texte).toBe('Bonjour Awa Diop, votre commande CMD-2026-0042 (Bâche standard · 300 × 200 cm · 1 ex.) est imprimée et prête : vous pouvez venir la retirer à Evocom Print.');
  });

  it('écrit la date de livraison dans le fuseau de l’entreprise', () => {
    expect(dateLisible('2026-10-09T14:00:00Z', 'Africa/Dakar')).toBe('vendredi 9 octobre à 14:00');
    expect(dateLisible('2026-10-09', 'Africa/Dakar')).toBe('vendredi 9 octobre');
    expect(dateLisible(null, 'Africa/Dakar')).toBe('date à confirmer');
    expect(dateLisible('n’importe quoi', 'Africa/Dakar')).toBe('date à confirmer');
  });
});

describe('réglages', () => {
  it('refuse les liens raccourcis et les heures mal formées', () => {
    expect(parametresWhatsAppSchema.safeParse({ modeles: { livre: 'Voir https://bit.ly/abc pour votre commande' } }).success).toBe(false);
    expect(parametresWhatsAppSchema.safeParse({ heures: { debut: '8h' } }).success).toBe(false);
    expect(parametresWhatsAppSchema.safeParse({ limites: { par_heure: 0 } }).success).toBe(false);
    expect(parametresWhatsAppSchema.safeParse({ autre: true }).success).toBe(false);
    expect(parametresWhatsAppSchema.safeParse({ actif: true, heures: { debut: '08:00', fin: '20:00' } }).success).toBe(true);
  });

  it('fusionne et contrôle la cohérence', () => {
    const { apres, erreurs } = fusionnerParametresWhatsApp(PARAMETRES_WHATSAPP_DEFAUT, { heures: { fin: '07:00' }, delai: { min_s: 100 } });
    expect(apres.heures).toEqual({ debut: '08:00', fin: '07:00' });
    expect(erreurs['heures.fin']).toBeTruthy();
    expect(erreurs['delai.max_s']).toBeTruthy();
    const ok = fusionnerParametresWhatsApp(PARAMETRES_WHATSAPP_DEFAUT, { actif: true, signature: 'Evocom' });
    expect(ok.erreurs).toEqual({});
    expect(ok.apres.actif).toBe(true);
    expect(ok.apres.modeles).toEqual(PARAMETRES_WHATSAPP_DEFAUT.modeles);
  });
});

describe('heures d’envoi', () => {
  const heures = { debut: '08:00', fin: '20:00' };
  it('respecte le fuseau', () => {
    expect(dansLesHeures(new Date('2026-10-09T07:59:00Z'), 'Africa/Dakar', heures)).toBe(false);
    expect(dansLesHeures(new Date('2026-10-09T08:00:00Z'), 'Africa/Dakar', heures)).toBe(true);
    expect(dansLesHeures(new Date('2026-10-09T19:59:00Z'), 'Africa/Dakar', heures)).toBe(true);
    expect(dansLesHeures(new Date('2026-10-09T20:00:00Z'), 'Africa/Dakar', heures)).toBe(false);
    // À Paris (UTC+2 en octobre), 07:00 UTC = 09:00.
    expect(dansLesHeures(new Date('2026-10-09T07:00:00Z'), 'Europe/Paris', heures)).toBe(true);
  });
});
