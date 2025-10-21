# 🔧 Correction des boutons d'actions des imprimeurs

## 🎯 **Problème identifié :**
Les boutons d'actions des imprimeurs affichaient toujours "Dossier non trouvé" au lieu de fonctionner correctement.

## 🔍 **Cause racine :**
Le service frontend `api.js` utilisait la route **`PUT /dossiers/:id/statut`** qui nécessite la permission `'update'`, mais les imprimeurs n'avaient que la permission `'change_status'`.

## ✅ **Solution appliquée :**

### 1. **Modification du service API frontend** (`frontend/src/services/api.js`)
**Avant :**
```javascript
const payload = {
  nouveau_statut: frenchStatus,
  commentaire: comment ?? null,
};
const response = await api.put(`/dossiers/${id}/statut`, payload);
```

**Après :**
```javascript
const payload = {
  status: newStatus,
  comment: comment ?? null,
};
const response = await api.patch(`/dossiers/${id}/status`, payload);
```

### 2. **Routes backend disponibles :**
- ✅ **`PUT /dossiers/:id/statut`** : Utilise `checkDossierPermission('update')` - Pour admin
- ✅ **`PATCH /dossiers/:id/status`** : Utilise `checkDossierPermission('change_status')` - Pour imprimeurs

### 3. **Permissions configurées :**
- ✅ `'change_status'` : Autorisé pour `['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur']`
- ✅ `'update'` : Autorisé pour `['admin', 'preparateur']` uniquement

## 🎉 **Résultat :**
- ✅ Les imprimeurs peuvent maintenant utiliser leurs boutons d'actions
- ✅ Plus de message "Dossier non trouvé" 
- ✅ Changements de statut fonctionnels pour tous les rôles
- ✅ Système de permissions respecté et sécurisé

## 📋 **Impacts des changements :**
1. **Frontend** : Le service `changeStatus` utilise maintenant la route appropriée
2. **Permissions** : Respect des rôles définis dans le middleware de permissions
3. **Sécurité** : Chaque rôle utilise sa route et ses permissions spécifiques
4. **UX** : Boutons fonctionnels pour tous les utilisateurs selon leur rôle

## 🔄 **Compatibilité :**
- ✅ L'ancienne route `PUT /statut` reste disponible pour l'admin
- ✅ Nouvelle route `PATCH /status` pour les imprimeurs/livreurs
- ✅ Aucune rupture de compatibilité avec l'existant

---

**Cette correction résout définitivement le problème "les boutons d'action sur imprimeur affiche toujour Dossier non trouvé"** 🎉