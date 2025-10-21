#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Script pour créer une page de nettoyage du localStorage
const cleanupHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nettoyage Session - Plateforme Imprimerie</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .card {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        .btn:hover {
            background: #0056b3;
        }
        .success {
            color: #28a745;
            margin: 15px 0;
        }
        .info {
            color: #6c757d;
            font-size: 14px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="card">
        <h2>🔧 Nettoyage de Session</h2>
        <p>Si vous rencontrez des problèmes de chargement, cliquez sur le bouton ci-dessous pour nettoyer votre session.</p>
        
        <button class="btn" onclick="cleanupAndRedirect()">
            🧹 Nettoyer la session
        </button>
        
        <div id="result"></div>
        
        <div class="info">
            Cette opération supprime les données de session expirées stockées localement.
        </div>
    </div>

    <script>
        function cleanupAndRedirect() {
            const result = document.getElementById('result');
            
            // Nettoyer toutes les données d'authentification
            const itemsToRemove = [
                'auth_token',
                'user_data', 
                'user',
                'authToken',
                'userData'
            ];
            
            let removedCount = 0;
            itemsToRemove.forEach(item => {
                if (localStorage.getItem(item)) {
                    localStorage.removeItem(item);
                    removedCount++;
                }
            });
            
            // Nettoyer sessionStorage aussi
            sessionStorage.clear();
            
            result.innerHTML = '<div class="success">✅ Session nettoyée (' + removedCount + ' éléments supprimés)</div>';
            
            setTimeout(() => {
                result.innerHTML += '<div class="info">➡️ Redirection vers la page de connexion...</div>';
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            }, 1000);
        }
        
        // Auto-nettoyage si paramètre auto=1 dans l'URL
        if (new URLSearchParams(window.location.search).get('auto') === '1') {
            setTimeout(cleanupAndRedirect, 500);
        }
    </script>
</body>
</html>
`;

// Créer le fichier dans le dossier public du frontend
const publicPath = '/Users/mac/plateforme-imprimerie-v3/backups/code_backup_20251003_131151/frontend/public';
const cleanupPath = path.join(publicPath, 'cleanup.html');

try {
    if (!fs.existsSync(publicPath)) {
        fs.mkdirSync(publicPath, { recursive: true });
    }
    
    fs.writeFileSync(cleanupPath, cleanupHtml);
    console.log('✅ Page de nettoyage créée: ' + cleanupPath);
    console.log('🌐 Accessible via: http://localhost:3001/cleanup.html');
    console.log('🔧 Auto-nettoyage: http://localhost:3001/cleanup.html?auto=1');
} catch (error) {
    console.error('❌ Erreur création page nettoyage:', error);
}