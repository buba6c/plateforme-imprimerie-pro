// Test simple de l'API frontend
const testFrontendAPI = async () => {
  try {
    console.log('🔍 Test de l\'API frontend...');
    
    // 1. Vérifier localStorage
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    console.log('📦 localStorage auth_token:', token ? 'Présent' : 'Absent');
    console.log('📦 localStorage user:', user ? 'Présent' : 'Absent');
    
    // 2. Test health check
    const healthResponse = await fetch('/api/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.status);
    
    // 3. Test dossiers sans auth
    const dossiersResponse = await fetch('/api/dossiers');
    const dossiersData = await dossiersResponse.json();
    console.log('❌ Dossiers sans auth:', dossiersData.message);
    
    // 4. Test login
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    console.log('🔑 Login result:', loginData.message || 'Success');
    
    if (loginData.token) {
      // 5. Test dossiers avec auth
      const authDossiersResponse = await fetch('/api/dossiers?limit=1', {
        headers: { 'Authorization': `Bearer ${loginData.token}` }
      });
      const authDossiersData = await authDossiersResponse.json();
      console.log('✅ Dossiers avec auth:', authDossiersData.success ? `${authDossiersData.dossiers.length} dossiers` : authDossiersData.message);
    }
    
  } catch (error) {
    console.error('❌ Erreur test:', error);
  }
};

// Ajouter à window pour utilisation dans la console
if (typeof window !== 'undefined') {
  window.testFrontendAPI = testFrontendAPI;
  console.log('✅ testFrontendAPI() disponible dans la console');
}
