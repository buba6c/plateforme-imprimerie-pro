#!/usr/bin/env node

/**
 * Script pour charger les tarifs dans PostgreSQL
 * Utilise la même connexion que le backend
 */

const { Client } = require('pg');

async function loadTariffs() {
  console.log('🚀 Chargement des tarifs...\n');

  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'imprimerie_db',
    user: 'imprimerie_user',
    password: 'PostgreSQL2024!'
  });

  try {
    await client.connect();
    console.log('✅ Connecté à PostgreSQL\n');

    // ========== TARIFS XEROX ==========
    console.log('📝 Insertion des tarifs Xerox...');
    
    const xeroxInserts = [
      // Format A4, N&B
      [1, 100, 'NB', 'A4', 100],
      [101, 500, 'NB', 'A4', 80],
      [501, 1000, 'NB', 'A4', 70],
      [1001, 999999, 'NB', 'A4', 60],
      
      // Format A4, Couleur
      [1, 100, 'COULEUR', 'A4', 200],
      [101, 500, 'COULEUR', 'A4', 150],
      [501, 1000, 'COULEUR', 'A4', 120],
      [1001, 999999, 'COULEUR', 'A4', 100],
      
      // Format A3, N&B
      [1, 100, 'NB', 'A3', 150],
      [101, 500, 'NB', 'A3', 120],
      [501, 1000, 'NB', 'A3', 100],
      [1001, 999999, 'NB', 'A3', 80],
      
      // Format A3, Couleur
      [1, 100, 'COULEUR', 'A3', 300],
      [101, 500, 'COULEUR', 'A3', 250],
      [501, 1000, 'COULEUR', 'A3', 200],
      [1001, 999999, 'COULEUR', 'A3', 150]
    ];

    for (const tariff of xeroxInserts) {
      try {
        await client.query(
          `INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) 
           VALUES ($1, $2, $3, $4, $5)`,
          tariff
        );
      } catch (e) {
        // Ignore duplicates
      }
    }
    console.log(`✅ Tarifs Xerox: ${xeroxInserts.length} lignes\n`);

    // ========== TARIFS ROLAND ==========
    console.log('📝 Insertion des tarifs Roland...');
    
    const rolandInserts = [
      ['A2', 'NB', 5000],
      ['A1', 'NB', 8000],
      ['A0', 'NB', 12000],
      ['A2', 'COULEUR', 10000],
      ['A1', 'COULEUR', 15000],
      ['A0', 'COULEUR', 25000],
      ['CUSTOM', 'NB', 1000],
      ['CUSTOM', 'COULEUR', 2000]
    ];

    for (const tariff of rolandInserts) {
      try {
        await client.query(
          `INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) 
           VALUES ($1, $2, $3)`,
          tariff
        );
      } catch (e) {
        // Ignore duplicates
      }
    }
    console.log(`✅ Tarifs Roland: ${rolandInserts.length} lignes\n`);

    // ========== FINITIONS ==========
    console.log('📝 Insertion des finitions...');
    
    const finitionInserts = [
      ['Agrafage', 'RELIURE', 1000],
      ['Pliage', 'FINITION', 500],
      ['Découpe', 'FINITION', 800],
      ['Pelliculage', 'FINITION', 2000],
      ['Vernis', 'FINITION', 1500],
      ['Reliure spirale', 'RELIURE', 2500],
      ['Reliure brochée', 'RELIURE', 3000],
      ['Estampage', 'FINITION', 1200]
    ];

    for (const finition of finitionInserts) {
      try {
        await client.query(
          `INSERT INTO finitions (nom, type, prix_unitaire) 
           VALUES ($1, $2, $3)`,
          finition
        );
      } catch (e) {
        // Ignore duplicates
      }
    }
    console.log(`✅ Finitions: ${finitionInserts.length} lignes\n`);

    // ========== VÉRIFICATION ==========
    console.log('📊 Vérification des données...');
    
    const xeroxCount = await client.query('SELECT COUNT(*) as count FROM tarifs_xerox');
    const rolandCount = await client.query('SELECT COUNT(*) as count FROM tarifs_roland');
    const finitionCount = await client.query('SELECT COUNT(*) as count FROM finitions');
    
    console.log(`✅ tarifs_xerox: ${xeroxCount.rows[0].count} lignes`);
    console.log(`✅ tarifs_roland: ${rolandCount.rows[0].count} lignes`);
    console.log(`✅ finitions: ${finitionCount.rows[0].count} lignes`);

    console.log('\n🎉 ÉTAPE 2 COMPLÈTE - Tous les tarifs chargés!\n');
    console.log('👉 Prochaine étape: node test-ia-intelligent.js\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

loadTariffs();
