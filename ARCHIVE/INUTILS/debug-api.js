#!/usr/bin/env node
/**
 * Debug de la réponse API
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJhZG1pbkBpbXByaW1lcmllLmNvbSIsInJvbGUiOiJhZG1pbiIsIm5vbSI6IkFkbWluIFByaW5jaXBhbCIsImlhdCI6MTc1OTYwODMzNywiZXhwIjoxNzU5Njk0NzM3fQ.0aQ1ofypzvTO0DMxE5VIfUmuGhDnf2mYcli40AaFyGU';

async function debugAPI() {
  try {
    const response = await axios.get(`${API_BASE}/dossiers`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    
    console.log('🔍 Réponse brute de l\'API:');
    console.log('Status:', response.status);
    console.log('Data type:', typeof response.data);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Erreur:', error.response?.data || error.message);
    console.log('Status:', error.response?.status);
  }
}

debugAPI();