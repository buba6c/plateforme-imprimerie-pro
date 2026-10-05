import bcrypt from 'bcryptjs';
import type pg from 'pg';
import { TARIFS_DEFAUT } from '@evocom/shared';
import { PARAMETRES_DEFAUT } from '../lib/params';

/** Données minimales d'une installation neuve : tarifs, paramètres, premier administrateur. */
/**
 * Résultat pour le premier administrateur : « cree », « reinitialise » (même adresse, mot de passe remplacé à la
 * demande de l'installateur), « existant » (un autre administrateur existe : rien n'est changé) ou « aucun ».
 */
export type SeedAdmin = 'cree' | 'reinitialise' | 'existant' | 'aucun';

export async function seedBase(
  pool: pg.Pool,
  admin?: { email: string; password: string; nom?: string; reinitialiser?: boolean },
): Promise<SeedAdmin> {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM tarifs');
  if (rows[0].n === 0) {
    let ordre = 0;
    for (const t of TARIFS_DEFAUT) {
      await pool.query(
        `INSERT INTO tarifs (machine, categorie, code, libelle, unite, prix, actif, ordre) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [t.machine, t.categorie, t.code, t.libelle, t.unite, t.prix, t.actif, ordre++],
      );
    }
  }
  for (const [cle, valeur] of Object.entries(PARAMETRES_DEFAUT)) {
    await pool.query(`INSERT INTO parametres (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO NOTHING`, [cle, JSON.stringify(valeur)]);
  }
  if (!admin) return 'aucun';
  const meme = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND lower(email) = lower($1)`, [admin.email]);
  if (meme.rowCount) {
    if (!admin.reinitialiser) return 'existant';
    // Installation relancée : le mot de passe affiché à l'installateur doit être le bon.
    await pool.query(
      `UPDATE users SET password_hash = $2, doit_changer_mdp = true, token_version = token_version + 1,
              echecs_connexion = 0, bloque_jusqu_a = NULL, is_active = true, updated_at = now()
       WHERE id = $1`,
      [meme.rows[0].id, await bcrypt.hash(admin.password, 12)],
    );
    return 'reinitialise';
  }
  const autre = await pool.query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
  if (autre.rowCount) return 'existant';
  await pool.query(
    `INSERT INTO users (nom, email, role, password_hash, doit_changer_mdp) VALUES ($1, lower($2), 'admin', $3, true)`,
    [admin.nom ?? 'Administrateur', admin.email, await bcrypt.hash(admin.password, 12)],
  );
  return 'cree';
}

/** Comptes de démonstration (environnement de test uniquement). */
export async function seedDemoUsers(pool: pg.Pool, password = 'Evocom2026!') {
  const hash = await bcrypt.hash(password, 10);
  const users = [
    ['Awa Ndiaye', 'admin@evocom.test', 'admin'],
    ['Fatou Sarr', 'prep@evocom.test', 'preparateur'],
    ['Ibrahima Fall', 'prep2@evocom.test', 'preparateur'],
    ['Moussa Diop', 'roland@evocom.test', 'imprimeur_roland'],
    ['Khady Ba', 'xerox@evocom.test', 'imprimeur_xerox'],
    ['Ousmane Gueye', 'livreur@evocom.test', 'livreur'],
  ] as const;
  for (const [nom, email, role] of users) {
    await pool.query(
      `INSERT INTO users (nom, email, role, password_hash) VALUES ($1,$2,$3,$4) ON CONFLICT (lower(email)) DO NOTHING`,
      [nom, email, role, hash],
    );
  }
}
