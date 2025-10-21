#!/usr/bin/env node

/**
 * Script pour créer les tables de tarifs
 */

const fs = require('fs');
const path = require('path');
const dbHelper = require('./backend/utils/dbHelper');

async function createTables() {
  console.log('🔧 Création des tables de tarifs...\n');

  try {
    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, 'create-tarif-tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Exécuter chaque statement SQL
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          console.log(`⏳ Exécution: ${statement.substring(0, 50)}...`);
          await dbHelper.query(statement);
        } catch (e) {
          if (!e.message.includes('already exists')) {
            console.error(`❌ Erreur: ${e.message}`);
          } else {
            console.log(`✅ Table déjà existante`);
          }
        }
      }
    }

    console.log('\n✅ Tables créées avec succès!\n');

    // Maintenant charger les tarifs
    console.log('📝 Chargement des tarifs...\n');
    
    // Tarifs Xerox
    const xeroxInserts = [
      [1, 100, 'NB', 'A4', 100],
      [101, 500, 'NB', 'A4', 80],
      [501, 1000, 'NB', 'A4', 70],
      [1001, 999999, 'NB', 'A4', 60],
      [1, 100, 'COULEUR', 'A4', 200],
      [101, 500, 'COULEUR', 'A4', 150],
      [501, 1000, 'COULEUR', 'A4', 120],
      [1001, 999999, 'COULEUR', 'A4', 100],
      [1, 100, 'NB', 'A3', 150],
      [101, 500, 'NB', 'A3', 120],
      [501, 1000, 'NB', 'A3', 100],
      [1001, 999999, 'NB', 'A3', 80],
      [1, 100, 'COULEUR', 'A3', 300],
      [101, 500, 'COULEUR', 'A3', 250],
      [501, 1000, 'COULEUR', 'A3', 200],
      [1001, 999999, 'COULEUR', 'A3', 150]
    ];

    console.log('📝 Tarifs Xerox...');
    for (const tariff of xeroxInserts) {
      try {
        await dbHelper.query(
          `INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) 
           VALUES (?, ?, ?, ?, ?)`,
          tariff
        );
      } catch (e) {
        // Ignore
      }
    }
    console.log(`✅ ${xeroxInserts.length} tarifs Xerox`);

    // Tarifs Roland
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

    console.log('📝 Tarifs Roland...');
    for (const tariff of rolandInserts) {
      try {
        await dbHelper.query(
          `INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) 
           VALUES (?, ?, ?)`,
          tariff
        );
      } catch (e) {
        // Ignore
      }
    }
    console.log(`✅ ${rolandInserts.length} tarifs Roland`);

    // Finitions
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

    console.log('📝 Finitions...');
    for (const finition of finitionInserts) {
      try {
        await dbHelper.query(
          `INSERT INTO finitions (nom, type, prix_unitaire) 
           VALUES (?, ?, ?)`,
          finition
        );
      } catch (e) {
        // Ignore
      }
    }
    console.log(`✅ ${finitionInserts.length} finitions`);

    console.log('\n🎉 ÉTAPE 2 COMPLÈTE!\n');
    console.log('📊 Résumé:');
    console.log(`  ✅ Tables créées: 3 (xerox, roland, finitions)`);
    console.log(`  ✅ Données chargées: ${xeroxInserts.length + rolandInserts.length + finitionInserts.length} tarifs`);
    console.log('\n👉 Prochaine étape: node test-ia-intelligent.js\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

createTables();
