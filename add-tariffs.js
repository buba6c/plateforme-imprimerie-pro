/**
 * Script pour ajouter les tarifs dans la base de données
 * Étape 2 du déblocage IA
 */

const mysql = require('mysql2/promise');

async function addTariffs() {
  console.log('📊 Ajout des tarifs dans la base de données...\n');

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'plateforme_user',
    password: 'SecurePass2024!',
    database: 'plateforme_imprimerie'
  });

  try {
    // ========== TARIFS XEROX ==========
    console.log('📝 Insertion des tarifs Xerox...');
    
    const xeroxTariffs = [
      // Format A4, N&B
      { nb_pages: '1-100', couleur: 'NB', format: 'A4', prix: 100 },
      { nb_pages: '101-500', couleur: 'NB', format: 'A4', prix: 80 },
      { nb_pages: '501-1000', couleur: 'NB', format: 'A4', prix: 70 },
      { nb_pages: '1001+', couleur: 'NB', format: 'A4', prix: 60 },
      
      // Format A4, Couleur
      { nb_pages: '1-100', couleur: 'COULEUR', format: 'A4', prix: 200 },
      { nb_pages: '101-500', couleur: 'COULEUR', format: 'A4', prix: 150 },
      { nb_pages: '501-1000', couleur: 'COULEUR', format: 'A4', prix: 120 },
      { nb_pages: '1001+', couleur: 'COULEUR', format: 'A4', prix: 100 },
      
      // Format A3, N&B
      { nb_pages: '1-100', couleur: 'NB', format: 'A3', prix: 150 },
      { nb_pages: '101-500', couleur: 'NB', format: 'A3', prix: 120 },
      { nb_pages: '501-1000', couleur: 'NB', format: 'A3', prix: 100 },
      { nb_pages: '1001+', couleur: 'NB', format: 'A3', prix: 80 },
      
      // Format A3, Couleur
      { nb_pages: '1-100', couleur: 'COULEUR', format: 'A3', prix: 300 },
      { nb_pages: '101-500', couleur: 'COULEUR', format: 'A3', prix: 250 },
      { nb_pages: '501-1000', couleur: 'COULEUR', format: 'A3', prix: 200 },
      { nb_pages: '1001+', couleur: 'COULEUR', format: 'A3', prix: 150 }
    ];

    for (const tariff of xeroxTariffs) {
      await connection.query(
        `INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          parseInt(tariff.nb_pages.split('-')[0]),
          tariff.nb_pages.includes('+') ? 99999 : parseInt(tariff.nb_pages.split('-')[1]),
          tariff.couleur,
          tariff.format,
          tariff.prix
        ]
      );
    }
    console.log(`✅ ${xeroxTariffs.length} tarifs Xerox insérés`);

    // ========== TARIFS ROLAND ==========
    console.log('📝 Insertion des tarifs Roland...');
    
    const rolandTariffs = [
      // Grand format, N&B
      { taille: 'A2', couleur: 'NB', prix: 5000 },
      { taille: 'A1', couleur: 'NB', prix: 8000 },
      { taille: 'A0', couleur: 'NB', prix: 12000 },
      
      // Grand format, Couleur
      { taille: 'A2', couleur: 'COULEUR', prix: 10000 },
      { taille: 'A1', couleur: 'COULEUR', prix: 15000 },
      { taille: 'A0', couleur: 'COULEUR', prix: 25000 },
      
      // Custom (par m2)
      { taille: 'CUSTOM', couleur: 'NB', prix: 1000 },
      { taille: 'CUSTOM', couleur: 'COULEUR', prix: 2000 }
    ];

    for (const tariff of rolandTariffs) {
      await connection.query(
        `INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) 
         VALUES (?, ?, ?)`,
        [tariff.taille, tariff.couleur, tariff.prix]
      );
    }
    console.log(`✅ ${rolandTariffs.length} tarifs Roland insérés`);

    // ========== FINITIONS ==========
    console.log('📝 Insertion des finitions...');
    
    const finitions = [
      { nom: 'Agrafage', type: 'RELIURE', prix: 1000 },
      { nom: 'Pliage', type: 'FINITION', prix: 500 },
      { nom: 'Découpe', type: 'FINITION', prix: 800 },
      { nom: 'Pelliculage', type: 'FINITION', prix: 2000 },
      { nom: 'Vernis', type: 'FINITION', prix: 1500 },
      { nom: 'Reliure spirale', type: 'RELIURE', prix: 2500 },
      { nom: 'Reliure brochée', type: 'RELIURE', prix: 3000 },
      { nom: 'Estampage', type: 'FINITION', prix: 1200 }
    ];

    for (const finition of finitions) {
      await connection.query(
        `INSERT INTO finitions (nom, type, prix_unitaire) 
         VALUES (?, ?, ?)`,
        [finition.nom, finition.type, finition.prix]
      );
    }
    console.log(`✅ ${finitions.length} finitions insérées`);

    // ========== VÉRIFICATION ==========
    console.log('\n📊 Vérification des données...');
    
    const [xeroxCount] = await connection.query('SELECT COUNT(*) as count FROM tarifs_xerox');
    const [rolandCount] = await connection.query('SELECT COUNT(*) as count FROM tarifs_roland');
    const [finitionCount] = await connection.query('SELECT COUNT(*) as count FROM finitions');
    
    console.log(`✅ tarifs_xerox: ${xeroxCount[0].count} lignes`);
    console.log(`✅ tarifs_roland: ${rolandCount[0].count} lignes`);
    console.log(`✅ finitions: ${finitionCount[0].count} lignes`);

    console.log('\n🎉 ÉTAPE 2 COMPLÈTE - Tous les tarifs chargés!');
    console.log('\n👉 Prochaine étape: node test-ia-intelligent.js');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await connection.end();
  }
}

addTariffs();
