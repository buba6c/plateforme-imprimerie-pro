#!/usr/bin/env node

// Script pour remplacer complètement les données mock par les FRESH

const fs = require('fs');
const path = require('path');

const mockApiPath = './frontend/src/services/mockApi.js';

console.log('🔧 Remplacement complet des données mock par FRESH-xxx');
console.log('===================================================\n');

try {
  // Lire le contenu actuel
  let content = fs.readFileSync(mockApiPath, 'utf8');
  
  // Trouver la section MOCK_DOSSIERS et la remplacer entièrement
  const startPattern = /let MOCK_DOSSIERS = .*?\[/s;
  const endPattern = /\];/;
  
  // Nouveau contenu FRESH uniquement
  const newMockData = `let MOCK_DOSSIERS = [
  // ⚠️ DONNÉES MOCK MISES À JOUR avec dossiers FRESH (sync avec DB réelle)
  {
    id: 17,
    numero_commande: 'FRESH-001',
    client_nom: 'Client Alpha',
    client_email: 'alpha@test.com',
    client_telephone: '01.23.45.67.89',
    type: 'roland',
    status: 'en_cours',
    assigned_to: 'imprimeur_roland',
    description: 'Test dossier Roland en cours',
    quantite: 100,
    format_papier: 'A4',
    urgence: false,
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preparateur_id: 2,
    montant_total: 50000
  },
  {
    id: 18,
    numero_commande: 'FRESH-002',
    client_nom: 'Client Beta',
    client_email: 'beta@test.com',
    client_telephone: '01.34.56.78.90',
    type: 'roland',
    status: 'en_impression',
    assigned_to: 'imprimeur_roland',
    description: 'Test dossier Roland en impression',
    quantite: 200,
    format_papier: 'A4',
    urgence: false,
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preparateur_id: 2,
    montant_total: 75000
  },
  {
    id: 19,
    numero_commande: 'FRESH-003',
    client_nom: 'Client Gamma',
    client_email: 'gamma@test.com',
    client_telephone: '01.45.67.89.01',
    type: 'xerox',
    status: 'en_cours',
    assigned_to: 'imprimeur_xerox',
    description: 'Test dossier Xerox en cours',
    quantite: 150,
    format_papier: 'A3',
    urgence: false,
    deadline: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preparateur_id: 2,
    montant_total: 60000
  },
  {
    id: 20,
    numero_commande: 'FRESH-004',
    client_nom: 'Client Delta',
    client_email: 'delta@test.com',
    client_telephone: '01.56.78.90.12',
    type: 'xerox',
    status: 'a_revoir',
    assigned_to: null,
    description: 'Test dossier Xerox à revoir',
    quantite: 75,
    format_papier: 'A4',
    urgence: true,
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preparateur_id: 2,
    montant_total: 40000
  }
];`;

  // Recherche de la première occurrence de MOCK_DOSSIERS jusqu'à la fin de l'array
  const mockDossiersStart = content.indexOf('let MOCK_DOSSIERS = ');
  
  if (mockDossiersStart === -1) {
    console.log('❌ Section MOCK_DOSSIERS non trouvée');
    return;
  }
  
  // Trouver la fin de l'array (le ]; final)
  let mockDossiersEnd = mockDossiersStart;
  let braceCount = 0;
  let inArray = false;
  
  for (let i = mockDossiersStart; i < content.length; i++) {
    if (content[i] === '[') {
      inArray = true;
      braceCount = 1;
    } else if (inArray && content[i] === '[') {
      braceCount++;
    } else if (inArray && content[i] === ']') {
      braceCount--;
      if (braceCount === 0) {
        mockDossiersEnd = i + 1;
        break;
      }
    }
  }
  
  // Remplacer la section
  const beforeSection = content.substring(0, mockDossiersStart);
  const afterSection = content.substring(mockDossiersEnd);
  
  const newContent = beforeSection + newMockData + afterSection;
  
  // Écrire le nouveau contenu
  fs.writeFileSync(mockApiPath, newContent, 'utf8');
  
  console.log('✅ Fichier mockApi.js mis à jour avec succès !');
  console.log('📄 Remplacé toutes les données CMD-2024-xxx par FRESH-xxx');
  console.log('🔄 Données mock maintenant synchronisées avec la base de données');
  
} catch (error) {
  console.error('❌ Erreur lors du remplacement:', error.message);
}