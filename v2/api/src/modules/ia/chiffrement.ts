// Chiffrement de la clé OpenAI au repos : AES-256-GCM, clé dérivée par HKDF-SHA256 de
// IA_CLE_CHIFFREMENT si elle est définie, sinon de JWT_SECRET. Changer ce secret rend la clé
// enregistrée illisible : l'administrateur doit alors la saisir de nouveau.

import crypto from 'node:crypto';

const VERSION = 'v1';
const SEL = 'evocom-print';
const CONTEXTE = 'evocom:ia:cle-openai:v1';

export class CleIllisible extends Error {
  constructor() {
    super('La clé enregistrée ne peut plus être lue : saisissez-la de nouveau.');
  }
}

function cleMaitre(): Buffer {
  const secret = process.env.IA_CLE_CHIFFREMENT || process.env.JWT_SECRET;
  if (!secret) throw new Error('Ni IA_CLE_CHIFFREMENT ni JWT_SECRET ne sont définis : impossible de chiffrer la clé OpenAI.');
  return Buffer.from(crypto.hkdfSync('sha256', secret, SEL, CONTEXTE, 32));
}

export function chiffrer(texte: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', cleMaitre(), iv, { authTagLength: 16 });
  c.setAAD(Buffer.from(CONTEXTE));
  const chiffre = Buffer.concat([c.update(texte, 'utf8'), c.final()]);
  return [VERSION, iv.toString('base64'), c.getAuthTag().toString('base64'), chiffre.toString('base64')].join(':');
}

/** Déchiffre ; lève CleIllisible si le secret a changé ou si la valeur est altérée. */
export function dechiffrer(valeur: string): string {
  const [version, iv, tag, chiffre] = valeur.split(':');
  if (version !== VERSION || !iv || !tag || chiffre === undefined) throw new CleIllisible();
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', cleMaitre(), Buffer.from(iv, 'base64'), { authTagLength: 16 });
    d.setAAD(Buffer.from(CONTEXTE));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(chiffre, 'base64')), d.final()]).toString('utf8');
  } catch {
    throw new CleIllisible();
  }
}
