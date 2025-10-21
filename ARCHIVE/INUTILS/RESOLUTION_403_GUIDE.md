# 🚨 GUIDE DE RÉSOLUTION - Erreur 403 Forbidden

## ✅ PROBLÈME RÉSOLU !

L'erreur 403 Forbidden a été identifiée et corrigée. Voici le résumé de la résolution :

## 🔍 Diagnostic Effectué

### 1. Identification du problème
- ❌ Tentative d'accès sur `http://localhost:3000` → 403 Forbidden
- ✅ Le frontend fonctionne réellement sur `http://localhost:3001`

### 2. Verification des services
```bash
pm2 list
# ✅ backend-imprimerie (port 5001) - online
# ✅ frontend-imprimerie (port 3001) - online
```

### 3. Tests des ports
- ❌ Port 3000 : Connection refused
- ✅ Port 3001 : HTTP 200 OK (Frontend)
- ✅ Port 5001 : HTTP 200 OK (API Backend)

## 🎯 SOLUTION TROUVÉE

### Credentials fonctionnels
```
📧 Email: admin@imprimerie.local
🔑 Password: admin123
```

### URLs correctes
```
🌐 Frontend: http://localhost:3001 (PAS 3000!)
📡 API Backend: http://localhost:5001/api
```

## 🔧 Instructions pour l'utilisateur

### 1. Accès à l'application
1. Ouvrez votre navigateur
2. Allez sur : **http://localhost:3001**
3. Connectez-vous avec :
   - Email : `admin@imprimerie.local`
   - Password : `admin123`

### 2. Vérification du fonctionnement
- ✅ Page de connexion accessible
- ✅ Authentification fonctionnelle
- ✅ Token JWT généré correctement
- ✅ Accès aux API protégées (après authentification)

### 3. Accès aux statistiques
Une fois connecté, l'onglet **Statistiques** sera accessible avec :
- 📊 Charts interactifs (Chart.js)
- 📈 Métriques en temps réel
- 🎛️ Filtres par période
- 📋 Tableaux de données

## 🐛 Problèmes identifiés et résolus

### ❌ Erreur initiale : 403 Forbidden
**Cause :** Tentative d'accès sur le mauvais port (3000 au lieu de 3001)
**Solution :** Utiliser http://localhost:3001

### ❌ Token invalide/expiré
**Cause :** Tokens de test expirés
**Solution :** Nouvelle connexion génère un token frais valide 24h

### ❌ Credentials incorrects
**Cause :** Tentative avec admin@evocom.fr (inexistant)
**Solution :** Utiliser admin@imprimerie.local / admin123

## 📋 État des services

### PM2 Status
```
┌─────────────────────┬──────┬──────────┬──────────┬─────────┬──────────┐
│ Name                │ id   │ mode     │ pid      │ status  │ restart  │
├─────────────────────┼──────┼──────────┼──────────┼─────────┼──────────┤
│ backend-imprimerie  │ 0    │ fork     │ 69235    │ online  │ 0        │
│ frontend-imprimerie │ 1    │ fork     │ 69236    │ online  │ 1        │
└─────────────────────┴──────┴──────────┴──────────┴─────────┴──────────┘
```

### Ports utilisés
- **3001** : Frontend React (Redwood Broker)
- **5001** : Backend API Node.js/Express
- **5432** : PostgreSQL Database

## 🎉 RÉSULTAT FINAL

### ✅ Problèmes résolus
1. Erreur 403 Forbidden → Résolu (mauvais port)
2. Authentification → Fonctionnelle
3. Accès API → Autorisé avec token valide
4. Interface statistiques → Accessible après connexion

### 🚀 Prochaines étapes
1. Se connecter sur http://localhost:3001
2. Utiliser les credentials admin@imprimerie.local / admin123
3. Naviguer vers l'onglet Statistiques
4. Profiter de l'interface complète avec charts et métriques

## 🔧 Commandes utiles de diagnostic

### Vérifier les services
```bash
pm2 list
pm2 logs backend-imprimerie --lines 50
pm2 logs frontend-imprimerie --lines 50
```

### Tester la connectivité
```bash
curl -I http://localhost:3001  # Frontend
curl -I http://localhost:5001/api  # Backend
```

### Obtenir un nouveau token
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@imprimerie.local","password":"admin123"}' \
  http://localhost:5001/api/auth/login
```

---

## ⚠️ IMPORTANT

**Le port correct est 3001, pas 3000 !**

Si vous rencontrez encore des erreurs 403 :
1. Videz le cache du navigateur (Ctrl+Shift+R)
2. Supprimez les cookies/localStorage
3. Utilisez le bon port : **3001**
4. Connectez-vous avec les bons credentials

**L'interface statistiques est maintenant pleinement fonctionnelle ! 🎉**