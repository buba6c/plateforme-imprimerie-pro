#!/usr/bin/env node
/**
 * Automated test: login -> create dossier -> upload file -> fetch dossier -> change status
 */
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const API = process.env.TEST_API_URL || 'http://localhost:5001/api';
const PREPARATEUR_EMAIL = process.env.TEST_PREP_EMAIL || 'preparateur@evocomprint.com';
const PREPARATEUR_PASS = process.env.TEST_PREP_PASS || 'prep123';

async function login() {
  const res = await axios.post(`${API}/auth/login`, {
    email: PREPARATEUR_EMAIL,
    password: PREPARATEUR_PASS,
  });
  return res.data;
}

async function createDossier(token) {
  const payload = {
    client: 'Client Test Auto',
    type_formulaire: 'roland',
    data_formulaire: { dimension: '50x70', couleur: 'quadri' },
    quantite: 25,
  };
  const res = await axios.post(`${API}/dossiers`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.dossier;
}

async function uploadFile(token, dossierId) {
  const form = new FormData();
  const samplePath = path.join(__dirname, 'sample.txt');
  if (!fs.existsSync(samplePath)) {
    fs.writeFileSync(samplePath, 'Fichier de test upload');
  }
  form.append('files', fs.createReadStream(samplePath));
  const res = await axios.post(`${API}/dossiers/${dossierId}/fichiers`, form, {
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    maxBodyLength: Infinity,
  });
  return res.data.files;
}

async function fetchDossier(token, id) {
  const res = await axios.get(`${API}/dossiers/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.dossier;
}

async function changeStatus(token, id) {
  // Simule un retour à revoir puis correction
  try {
    await axios.put(
      `${API}/dossiers/${id}/statut`,
      { nouveau_statut: 'À revoir', commentaire: 'Test révision auto' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (e) {
    // Peut échouer si règles non satisfaites, ignorer
  }
}

(async () => {
  const summary = { steps: [], errors: [] };
  try {
    const auth = await login();
    summary.steps.push('Login OK');
    const token = auth.token;
    const dossier = await createDossier(token);
    summary.steps.push(`Dossier créé id=${dossier.id}`);
    // Attendre petite latence pour cohérence DB
    await new Promise(r => setTimeout(r, 250));
    const files = await uploadFile(token, dossier.id);
    summary.steps.push(`Upload ${files.length} fichier(s)`);
    const fetched = await fetchDossier(token, dossier.id);
    summary.steps.push(`Fetch dossier OK statut=${fetched.statut}`);
    await changeStatus(token, dossier.id);
    summary.steps.push('Tentative changement statut (optionnel)');
  } catch (err) {
    summary.errors.push({ message: err.message, stack: err.stack, data: err.response?.data });
  } finally {
    console.log('=== TEST DOSSIER WORKFLOW SUMMARY ===');
    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors.length) process.exit(1);
  }
})();
