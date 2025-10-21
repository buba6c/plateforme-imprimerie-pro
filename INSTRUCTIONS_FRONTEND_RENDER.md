# Instructions déploiement Frontend sur Render

## 🚀 ÉTAPES POUR DÉPLOYER L'INTERFACE WEB

### 1. Créer le service Frontend sur Render

1. **Allez sur** : https://render.com/dashboard
2. **Cliquez** "New +" → **"Static Site"**
3. **Connect Repository** → Sélectionnez `buba6c/plateforme-imprimerie-pro`

### 2. Configuration du service

```
Name: imprimerie-frontend
Branch: main
Root Directory: frontend
Build Command: npm install && npm run build
Publish Directory: build
Auto-Deploy: Yes
```

### 3. Variables d'environnement

Ajoutez ces variables dans l'onglet "Environment" :

```env
REACT_APP_API_URL=https://plateforme-imprimerie-pro.onrender.com/api
REACT_APP_SOCKET_URL=https://plateforme-imprimerie-pro.onrender.com
REACT_APP_ENVIRONMENT=production
GENERATE_SOURCEMAP=false
CI=false
NODE_VERSION=18
```

### 4. Configuration avancée (optionnelle)

Dans l'onglet "Settings" → "Headers" :
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin

/static/*
  Cache-Control: public, max-age=31536000, immutable
```

### 5. Redirection pour React Router

Dans l'onglet "Redirects & Rewrites" :
```
/*  /index.html  200
```

## ✅ Résultat attendu

Après déploiement (5-10 minutes) :
- **Frontend** : https://imprimerie-frontend.onrender.com
- **Backend** : https://plateforme-imprimerie-pro.onrender.com

## 🎯 Test de l'interface

1. Ouvrez : https://imprimerie-frontend.onrender.com
2. Vous devriez voir la page de connexion
3. Login test : admin@imprimerie.com / admin123

## 🔧 En cas de problème

### Erreur de build :
- Vérifiez les logs de build sur Render
- Vérifiez que `frontend/package.json` existe
- Vérifiez la commande de build

### Erreur de connexion API :
- Vérifiez `REACT_APP_API_URL`
- Testez : https://plateforme-imprimerie-pro.onrender.com/api/health

### Page blanche :
- Vérifiez la redirection `/*  /index.html  200`
- Vérifiez les logs du navigateur (F12)

---

**🚀 Une fois déployé, vous aurez l'interface web complète de votre plateforme !**