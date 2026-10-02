# 🚀 GUIDE DE DÉPLOIEMENT - Sections Multi-Supports

## ⚠️ IMPORTANT: Rendre les modifications VISIBLES

Les nouveaux composants React ne sont **pas automatiquement visibles** sur la plateforme.
Il faut **rebuilder le frontend** pour compiler les changements.

---

## 📋 Étape 1: Vérifier l'état actuel

### Backend (devrait être OK)
```bash
pm2 list
# ✅ Status: online
```

### Frontend (nécessite rebuild)
```bash
ls -lh /var/www/imprimerie/frontend/build/
# Vérifier la date du build
```

---

## 🔨 Étape 2: Rebuilder le frontend

### Option A: Script automatique (RECOMMANDÉ)
```bash
cd /var/www/imprimerie
./deploy-frontend.sh
```

**Durée estimée**: 2-3 minutes

### Option B: Rebuild manuel
```bash
cd /var/www/imprimerie/frontend
npm install
npm run build
```

---

## ✅ Étape 3: Vérifier le déploiement

### 1. Vérifier les fichiers de build
```bash
ls -lh /var/www/imprimerie/frontend/build/static/js/
# Doit contenir des fichiers .js récents (date d'aujourd'hui)
```

### 2. Vérifier que nginx sert le nouveau build
```bash
curl -I http://localhost | grep "HTTP"
# Devrait retourner 200 OK
```

### 3. Tester dans le navigateur
```
http://VOTRE_IP_SERVEUR/
```

**Vider le cache du navigateur**: Ctrl+Shift+R (ou Cmd+Shift+R sur Mac)

---

## 🧪 Étape 4: Tester les nouvelles fonctionnalités

### Test 1: Créer dossier avec sections
1. Aller sur `/dossiers/new`
2. Sélectionner type "Xerox"
3. ✅ **Vérifier que le toggle "Sections multiples" est visible**
4. Activer le toggle
5. ✅ **Vérifier que SectionsManager s'affiche**
6. Ajouter une section (Couverture A4 couleur)
7. Définir amount: 15000
8. Créer le dossier

### Test 2: Voir les sections dans DossierDetails
1. Ouvrir le dossier créé
2. ✅ **Vérifier que SectionsDisplay (bleu) s'affiche**
3. ✅ **Vérifier que AmountBadge (jaune) s'affiche**
4. ✅ **Vérifier que le bouton "Modifier les sections" est visible**

### Test 3: Éditer les sections
1. Cliquer sur "Modifier les sections"
2. ✅ **Vérifier que EditSectionsModal s'ouvre**
3. Ajouter une 2ème section (Intérieur A4 nb)
4. Cliquer "Enregistrer"
5. ✅ **Vérifier que les 2 sections s'affichent**

### Test 4: Roland multi-supports
1. Créer nouveau dossier type "Roland"
2. ✅ **Vérifier toggle "Supports multiples"**
3. Ajouter 2 supports (bâche + vinyle)
4. Vérifier calcul surface automatique
5. Créer et ouvrir le dossier
6. ✅ **Vérifier SupportsDisplay (vert)**

---

## 🐛 Dépannage

### Problème: Toggle sections non visible
**Cause**: Build frontend pas à jour
**Solution**:
```bash
cd /var/www/imprimerie
./deploy-frontend.sh
```

### Problème: Erreur "SectionsManager is not defined"
**Cause**: Composant pas compilé dans le build
**Solution**:
```bash
# Vérifier que les fichiers existent
ls -l /var/www/imprimerie/frontend/src/components/dossiers/Section*.js

# Rebuilder
./deploy-frontend.sh
```

### Problème: Modifications non visibles après rebuild
**Cause**: Cache navigateur
**Solution**:
- Chrome/Edge: Ctrl+Shift+R
- Firefox: Ctrl+F5
- Safari: Cmd+Option+R
- Ou ouvrir en navigation privée

### Problème: Erreur 502 Bad Gateway
**Cause**: Backend non démarré
**Solution**:
```bash
pm2 restart imprimerie-backend
pm2 logs --lines 50
```

---

## 📊 Checklist de validation

Après déploiement, vérifier:

- [ ] Backend online (pm2 list)
- [ ] Build frontend récent (< 5 min)
- [ ] Nginx répond (curl http://localhost)
- [ ] Page d'accueil charge
- [ ] Toggle sections visible dans CreateDossier
- [ ] SectionsManager fonctionne
- [ ] SectionsDisplay affiche correctement
- [ ] EditSectionsModal s'ouvre
- [ ] Sauvegarde fonctionne
- [ ] AmountBadge visible (selon rôle)
- [ ] SupportsManager pour Roland
- [ ] Permissions respectées (admin + preparateur)

---

## 🔄 Workflow de développement

### Modifier un composant React
1. Éditer `/var/www/imprimerie/frontend/src/components/dossiers/XXX.js`
2. **Rebuilder**: `./deploy-frontend.sh`
3. Recharger navigateur (Ctrl+Shift+R)
4. Tester les modifications

### Modifier le backend
1. Éditer `/var/www/imprimerie/backend/routes/XXX.js`
2. **Redémarrer**: `pm2 restart imprimerie-backend`
3. Vérifier logs: `pm2 logs`
4. Tester l'API

---

## 📝 Notes importantes

### Build de production
Le build frontend optimise:
- Minification JS/CSS
- Code splitting
- Tree shaking
- Compression assets

**Résultat**: Bundle final ~2-3 MB (vs ~50 MB en dev)

### Cache navigateur
Les fichiers ont des hash dans le nom:
```
main.abc123def.js
main.abc123def.css
```

Le hash change à chaque build → force le reload du cache

### Hot reload NON disponible
Le mode `npm start` (dev) n'est **pas recommandé** en production.
Toujours utiliser `npm run build` + rebuild manuel.

---

## 🚀 Commandes rapides

```bash
# Déployer tout
cd /var/www/imprimerie && ./deploy-frontend.sh

# Vérifier statut
pm2 list && ls -lh frontend/build/ | head -5

# Logs backend
pm2 logs imprimerie-backend --lines 100

# Tester API
curl http://localhost:5001/api/health

# Vider cache nginx (si applicable)
sudo systemctl reload nginx
```

---

## ✅ Résumé

**Pour rendre les modifications VISIBLES**:
1. ✅ Backend déjà redémarré (pm2 restart 151)
2. 🔄 **Frontend à rebuilder** ← ÉTAPE CRITIQUE
3. 🌐 Recharger navigateur avec Ctrl+Shift+R

**Commande unique**:
```bash
/var/www/imprimerie/deploy-frontend.sh
```

**Durée totale**: 2-3 minutes

**Après ça, TOUT sera visible et fonctionnel !** 🎉
