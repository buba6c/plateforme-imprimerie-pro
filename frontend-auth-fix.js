
// 🔧 SCRIPT DE CORRECTION AUTHENTIFICATION FRONTEND
// Copier ce code dans la console du navigateur (F12)

console.log('🔧 Correction authentification frontend...');

// 1. Nettoyer l'ancien token
localStorage.removeItem('auth_token');
localStorage.removeItem('user');

// 2. Définir le nouveau token valide
const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjMsImVtYWlsIjoiYWRtaW5AdGVzdC5sb2NhbCIsInJvbGUiOiJhZG1pbiIsIm5vbSI6IkFkbWluIFRlc3QgUmVzZXQiLCJpYXQiOjE3NTk2MDkzNzQsImV4cCI6MTc1OTY5NTc3NH0._VuGjIm0v103l6VjE6C0SDXid2wKQmSRGyCMMInsnQw';
const validUser = {
  id: 23,
  nom: 'Admin Test Reset',
  email: 'admin@test.local',
  role: 'admin'
};

// 3. Sauvegarder dans localStorage
localStorage.setItem('auth_token', validToken);
localStorage.setItem('user', JSON.stringify(validUser));

console.log('✅ Token mis à jour:', validToken.substring(0, 30) + '...');
console.log('✅ Utilisateur sauvegardé:', validUser);

// 4. Recharger la page pour appliquer les changements
console.log('🔄 Rechargement de la page...');
setTimeout(() => {
  window.location.reload();
}, 1000);
