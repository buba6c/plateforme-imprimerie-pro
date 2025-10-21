const axios = require('axios');

async function testFilesAll() {
  try {
    // 1. Login
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@imprimerie.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login success');
    
    // 2. Test /files/all
    const filesResponse = await axios.get('http://localhost:5001/api/files/all?limit=2', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Files response:', filesResponse.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 500) {
      console.error('Server Error Details:', error.response.data);
    }
  }
}

testFilesAll();