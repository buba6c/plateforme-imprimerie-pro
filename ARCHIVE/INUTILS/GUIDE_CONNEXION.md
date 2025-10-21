# 🔐 Guide de Connexion - Plateforme Imprimerie

## ✅ Configuration Actuelle

### Services
- **Backend** : http://localhost:5001
- **Frontend** : http://localhost:3001
- **Documentation API** : http://localhost:5001/api-docs

### Identifiants de Connexion

#### Administrateur
```
Email: admin@imprimerie.com
Mot de passe: admin123
```

#### Autres comptes disponibles
Consultez la base de données pour voir tous les comptes :
```bash
psql -U imprimerie_user -d imprimerie_db -c "SELECT email, role FROM users WHERE is_active = true;"
```

## 🚀 Démarrage des Services

### Avec le script de gestion
```bash
cd /Users/mac/plateforme-imprimerie-v3/backups/code_backup_20251003_131151
./manage.sh start
```

### Manuellement
```bash
# Backend
pm2 start plateforme-backend

# Frontend  
pm2 start plateforme-frontend
```

### Vérifier l'état
```bash
pm2 list
pm2 logs
```

## 🔧 Résolution des Problèmes Courants

### Erreur 401 (Unauthorized)
**Cause** : Mot de passe incorrect
**Solution** : Utilisez les identifiants ci-dessus ou réinitialisez le mot de passe :
```bash
cd /Users/mac/plateforme-imprimerie-v3/backups/code_backup_20251003_131151/backend
node test-password.js
```

### Erreur CORS
**Cause** : Configuration CORS incorrecte
**Solution** : Le backend a été corrigé pour autoriser `http://localhost:3001`
- Redémarrez le backend : `pm2 restart plateforme-backend`
- Videz le cache du navigateur : Cmd+Shift+R (Mac) ou Ctrl+Shift+R (Windows/Linux)

### Erreur de connexion réseau
**Cause** : Services non démarrés ou mauvaise URL
**Solution** :
1. Vérifiez que les services sont en ligne : `pm2 list`
2. Vérifiez la configuration dans `/frontend/.env.local` :
   ```
   REACT_APP_API_URL=http://localhost:5001/api
   ```

### Frontend ne démarre pas
**Cause** : Port 3001 déjà utilisé
**Solution** :
```bash
# Trouver le processus utilisant le port
lsof -ti:3001

# Tuer le processus
kill -9 <PID>

# Redémarrer le frontend
pm2 restart plateforme-frontend
```

## 📝 Commandes Utiles

### Base de données
```bash
# Se connecter à la base
psql -U imprimerie_user -d imprimerie_db

# Lister les utilisateurs
psql -U imprimerie_user -d imprimerie_db -c "SELECT email, role, is_active FROM users;"

# Voir les dossiers
psql -U imprimerie_user -d imprimerie_db -c "SELECT numero, statut FROM dossiers LIMIT 10;"
```

### Logs
```bash
# Logs en temps réel
pm2 logs

# Logs du backend uniquement
pm2 logs plateforme-backend

# Logs du frontend uniquement
pm2 logs plateforme-frontend

# Dernières 50 lignes
pm2 logs --lines 50
```

### Test de l'API
```bash
# Health check
curl http://localhost:5001/api/health

# Test de connexion
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@imprimerie.com","password":"admin123"}'
```

## 🎯 Workflow de Développement

1. **Démarrez les services** : `./manage.sh start`
2. **Ouvrez le frontend** : http://localhost:3001
3. **Connectez-vous** avec admin@imprimerie.com / admin123
4. **Consultez les logs** si besoin : `pm2 logs`
5. **Arrêtez les services** quand vous avez fini : `./manage.sh stop`

## 🔄 Modifications de Code

### Backend
Après modification du code backend :
```bash
pm2 restart plateforme-backend
# ou
./manage.sh restart
```

### Frontend
Après modification du code frontend :
```bash
pm2 restart plateforme-frontend
# ou
./manage.sh restart
```

## 📞 Support

En cas de problème, vérifiez :
1. ✅ Les services sont démarrés (`pm2 list`)
2. ✅ La base de données est accessible
3. ✅ Les logs ne montrent pas d'erreurs (`pm2 logs`)
4. ✅ Les variables d'environnement sont correctes (`.env.local`)
5. ✅ Le cache du navigateur est vidé

---

**Dernière mise à jour** : 8 octobre 2025
**Version de la plateforme** : 3.0
**Chemin du projet** : `/Users/mac/plateforme-imprimerie-v3/backups/code_backup_20251003_131151`
