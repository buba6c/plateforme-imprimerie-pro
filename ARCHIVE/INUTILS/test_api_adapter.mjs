// Test script pour debugger l'apiAdapter
import { dossiersService } from './src/services/apiAdapter.js';

async function testApiAdapter() {
  console.log('🧪 Test apiAdapter - getDossiers');
  
  try {
    console.log('Appel getDossiers...');
    const result = await dossiersService.getDossiers({});
    console.log('✅ Succès:', result);
  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack:', error.stack);
  }
}

// Simuler l'environnement Node.js pour les tests
if (typeof window === 'undefined') {
  global.window = {};
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
}

testApiAdapter();