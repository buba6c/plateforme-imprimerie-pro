#!/usr/bin/env node

// 📊 CRÉATION DONNÉES DE TEST - CONFORMES CAHIER DES CHARGES
// =========================================================

const { Pool } = require('pg');

const pool = new Pool({
  user: 'imprimerie_user',
  host: 'localhost',
  database: 'imprimerie_db',
  password: 'imprimerie_password',
  port: 5432,
});

async function createTestData() {
  console.log('🚀 Création des données de test conformes au cahier des charges...\n');

  try {
    // Récupérer les IDs des utilisateurs
    const usersResult = await pool.query('SELECT id, email, role FROM users');
    const users = {};
    usersResult.rows.forEach(user => {
      if (user.role === 'admin') users.admin = user.id;
      else if (user.role === 'preparateur') users.preparateur = user.id;
      else if (user.role === 'imprimeur_roland') users.roland = user.id;
      else if (user.role === 'imprimeur_xerox') users.xerox = user.id;
      else if (user.role === 'livreur') users.livreur = user.id;
    });

    console.log('👥 Utilisateurs trouvés:', users);

    // Nettoyer les données existantes
    await pool.query('DELETE FROM dossiers');
    console.log('🗑️ Données existantes supprimées\n');

    // 6 dossiers de test selon le cahier des charges
    const testDossiers = [
      {
        numero: 'WF-ROLAND-001',
        client: 'Café Central',
        type_formulaire: 'roland',
        statut: 'en_cours',
        preparateur_id: users.preparateur,
        data_formulaire: { dimension: '100x70', surface_m2: 7, types_impression: ['Bâche'] },
        commentaire: 'Dossier test Roland en cours'
      },
      {
        numero: 'WF-ROLAND-002', 
        client: 'Boulangerie Martin',
        type_formulaire: 'roland',
        statut: 'a_revoir',
        preparateur_id: users.preparateur,
        data_formulaire: { dimension: '80x60', surface_m2: 4.8, types_impression: ['Vinyle'] },
        commentaire: 'Dossier à revoir - spécifications manquantes'
      },
      {
        numero: 'WF-ROLAND-003',
        client: 'Restaurant Gourmet', 
        type_formulaire: 'roland',
        statut: 'en_impression',
        preparateur_id: users.preparateur,
        data_formulaire: { dimension: '200x100', surface_m2: 20, types_impression: ['Bâche'] },
        commentaire: 'Dossier en cours d\'impression'
      },
      {
        numero: 'WF-XEROX-001',
        client: 'Bureau Conseil',
        type_formulaire: 'xerox', 
        statut: 'termine',
        preparateur_id: users.preparateur,
        data_formulaire: { format: 'A4', type_document: 'Flyer', nombre_exemplaires: 500, type_papier: '150g' },
        commentaire: 'Dossier terminé, prêt livraison'
      },
      {
        numero: 'WF-XEROX-002',
        client: 'Clinique Santé',
        type_formulaire: 'xerox',
        statut: 'en_livraison', 
        preparateur_id: users.preparateur,
        data_formulaire: { format: 'A3', type_document: 'Affiche', nombre_exemplaires: 100, type_papier: '200g' },
        commentaire: 'Dossier en cours de livraison'
      },
      {
        numero: 'WF-XEROX-003',
        client: 'École Primaire',
        type_formulaire: 'xerox',
        statut: 'livre',
        preparateur_id: users.preparateur,
        data_formulaire: { format: 'A4', type_document: 'Brochure', nombre_exemplaires: 200, type_papier: '120g' },
        commentaire: 'Dossier livré et archivé'
      }
    ];

    console.log('📋 Création des 6 dossiers de test...\n');

    for (let i = 0; i < testDossiers.length; i++) {
      const dossier = testDossiers[i];
      
      const query = `
        INSERT INTO dossiers (
          numero, client, type_formulaire, statut, preparateur_id, 
          data_formulaire, commentaire, quantite
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, numero, client, statut, type_formulaire
      `;

      const values = [
        dossier.numero,
        dossier.client, 
        dossier.type_formulaire,
        dossier.statut,
        dossier.preparateur_id,
        dossier.data_formulaire,
        dossier.commentaire,
        1 // quantité par défaut
      ];

      const result = await pool.query(query, values);
      const created = result.rows[0];
      
      console.log(`✅ ${i+1}/6: ${created.numero} - ${created.client} (${created.type_formulaire}, ${created.statut})`);
    }

    console.log('\n🎯 RÉSUMÉ DES DONNÉES CRÉÉES:');
    console.log('===============================');
    
    const summary = await pool.query(`
      SELECT 
        type_formulaire,
        statut,
        COUNT(*) as count
      FROM dossiers 
      GROUP BY type_formulaire, statut 
      ORDER BY type_formulaire, statut
    `);
    
    summary.rows.forEach(row => {
      console.log(`📊 ${row.type_formulaire.toUpperCase()}: ${row.count} dossier(s) en "${row.statut}"`);
    });

    console.log('\n✅ DONNÉES DE TEST CRÉÉES AVEC SUCCÈS !');
    console.log('🔍 Ces données respectent le cahier des charges:');
    console.log('   - 3 dossiers Roland (en_cours, a_revoir, en_impression)');  
    console.log('   - 3 dossiers Xerox (termine, en_livraison, livre)');
    console.log('   - Diversité des statuts pour tester la visibilité par rôle');

  } catch (error) {
    console.error('❌ Erreur lors de la création des données:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTestData();