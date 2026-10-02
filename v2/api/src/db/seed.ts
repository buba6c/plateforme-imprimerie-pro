import bcrypt from 'bcryptjs';
import type pg from 'pg';
import { TARIFS_DEFAUT } from '@evocom/shared';
import { PARAMETRES_DEFAUT } from '../lib/params';

/** Données minimales d'une installation neuve : tarifs, paramètres, premier administrateur. */
export async function seedBase(pool: pg.Pool, admin?: { email: string; password: string; nom?: string }) {
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
  if (admin) {
    const exists = await pool.query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
    if (!exists.rowCount) {
      await pool.query(
        `INSERT INTO users (nom, email, role, password_hash, doit_changer_mdp) VALUES ($1, lower($2), 'admin', $3, true)`,
        [admin.nom ?? 'Administrateur', admin.email, await bcrypt.hash(admin.password, 12)],
      );
    }
  }
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
