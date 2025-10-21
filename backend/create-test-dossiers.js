#!/usr/bin/env node

const { Pool } = require('pg');

async function createTestDossiers() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });

  console.log('📁 CRÉATION DOSSIERS DE TEST');
  console.log('============================\n');

  try {
    // Récupérer les utilisateurs
    const usersResult = await pool.query('SELECT id, email, role FROM users');
    const users = {};
    usersResult.rows.forEach(user => {
      if (user.role === 'admin') users.admin = user.id;
      else if (user.role === 'preparateur') users.preparateur = user.id;
      else if (user.role === 'imprimeur_roland') users.roland = user.id;
      else if (user.role === 'imprimeur_xerox') users.xerox = user.id;
      else if (user.role === 'livreur') users.livreur = user.id;
    });

    console.log('👥 Utilisateurs récupérés:', users);

    // Dossiers de test réalistes
    const testDossiers = [
      {
        numero: 'DOSS-2024-001',
        client: 'Restaurant Le Baobab',
        type_formulaire: 'roland',
        statut: 'en_cours',
        preparateur_id: users.preparateur,
        data_formulaire: { 
          dimension: '200x150', 
          surface_m2: 3, 
          types_impression: ['Bâche'], 
          finition: ['oeillet_colle'],
          urgence: false
        },
        commentaire: 'Menu extérieur restaurant - livraison prévue vendredi',
        montant_cfa: 45000
      },
      {
        numero: 'DOSS-2024-002',
        client: 'Pharmacie Nouvelle',
        type_formulaire: 'xerox',
        statut: 'a_revoir',
        preparateur_id: users.preparateur,
        imprimeur_id: users.xerox,
        data_formulaire: {
          format: 'A4',
          nombre_pages: 500,
          couleur: 'couleur',
          finition: 'reliure',
          papier: 'standard'
        },
        commentaire: 'Brochures promotionnelles - révision couleurs demandée',
        montant_cfa: 25000
      },
      {
        numero: 'DOSS-2024-003',
        client: 'Ecole Primaire Liberté',
        type_formulaire: 'xerox',
        statut: 'en_impression',
        preparateur_id: users.preparateur,
        imprimeur_id: users.xerox,
        data_formulaire: {
          format: 'A4',
          nombre_pages: 2000,
          couleur: 'noir_blanc',
          finition: 'agrafage',
          papier: 'standard'
        },
        commentaire: 'Supports de cours trimestre - impression en cours',
        montant_cfa: 15000
      },
      {
        numero: 'DOSS-2024-004',
        client: 'Boutique Fashion Style',
        type_formulaire: 'roland',
        statut: 'termine',
        preparateur_id: users.preparateur,
        imprimeur_id: users.roland,
        data_formulaire: {
          dimension: '300x200',
          surface_m2: 6,
          types_impression: ['Bâche', 'Vinyle'],
          finition: ['decoupe_forme'],
          urgence: true
        },
        commentaire: 'Enseigne boutique - terminé, prêt pour livraison',
        montant_cfa: 85000
      },
      {
        numero: 'DOSS-2024-005',
        client: 'Garage Auto Plus',
        type_formulaire: 'roland',
        statut: 'en_livraison',
        preparateur_id: users.preparateur,
        imprimeur_id: users.roland,
        livreur_id: users.livreur,
        data_formulaire: {
          dimension: '150x100',
          surface_m2: 1.5,
          types_impression: ['Vinyle'],
          finition: ['pose_installation'],
          urgence: false
        },
        commentaire: 'Vitrine garage - en cours de livraison',
        montant_cfa: 35000
      },
      {
        numero: 'DOSS-2024-006',
        client: 'Association Jeunesse Espoir',
        type_formulaire: 'xerox',
        statut: 'livre',
        preparateur_id: users.preparateur,
        imprimeur_id: users.xerox,
        livreur_id: users.livreur,
        data_formulaire: {
          format: 'A3',
          nombre_pages: 200,
          couleur: 'couleur',
          finition: 'plastification',
          papier: 'premium'
        },
        commentaire: 'Affiches événement - livré avec succès',
        montant_cfa: 18000
      }
    ];

    // Créer les dossiers
    for (const dossier of testDossiers) {
      try {
        const result = await pool.query(
          `INSERT INTO dossiers (numero, client, type_formulaire, statut, preparateur_id, imprimeur_id, livreur_id, data_formulaire, commentaire, montant_cfa, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
           RETURNING id`,
          [
            dossier.numero,
            dossier.client,
            dossier.type_formulaire,
            dossier.statut,
            dossier.preparateur_id,
            dossier.imprimeur_id || null,
            dossier.livreur_id || null,
            JSON.stringify(dossier.data_formulaire),
            dossier.commentaire,
            dossier.montant_cfa
          ]
        );

        console.log(`✅ Créé: ${dossier.numero} | ${dossier.client} | ${dossier.statut} | ${dossier.montant_cfa} FCFA`);

        // Ajouter historique du statut
        await pool.query(
          `INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
           VALUES ($1, NULL, $2, $3, $4, NOW())`,
          [result.rows[0].id, dossier.statut, dossier.preparateur_id, `Dossier créé avec statut ${dossier.statut}`]
        );

      } catch (error) {
        console.error(`❌ Erreur ${dossier.numero}:`, error.message);
      }
    }

    // Résumé final
    console.log('\n📊 RÉSUMÉ FINAL');
    console.log('================');
    const summary = await pool.query(`
      SELECT statut, COUNT(*) as nombre, SUM(montant_cfa) as total_fcfa
      FROM dossiers 
      GROUP BY statut 
      ORDER BY statut
    `);

    summary.rows.forEach(row => {
      console.log(`${row.statut.padEnd(15)} | ${row.nombre} dossiers | ${row.total_fcfa?.toLocaleString() || 0} FCFA`);
    });

    const totalDossiers = await pool.query('SELECT COUNT(*) as total FROM dossiers');
    console.log(`\n🎉 ${totalDossiers.rows[0].total} dossiers de test créés avec succès !`);

  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

// Exécuter si appelé directement
if (require.main === module) {
  createTestDossiers();
}

module.exports = { createTestDossiers };