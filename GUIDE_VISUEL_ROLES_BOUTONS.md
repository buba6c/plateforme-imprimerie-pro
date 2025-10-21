# 🎯 GUIDE VISUEL RAPIDE - RÔLES ET BOUTONS

**Version simplifiée pour référence rapide**

---

## 📋 PRÉPARATEUR

### Dossiers visibles
```
🔵 Nouveau  →  🟡 En cours  →  🔴 À revoir  →  🟣 Prêt impression
```

### Boutons par statut
```
🔵 NOUVEAU
   └─ [📋 Marquer prêt pour impression]

🟡 EN COURS  
   └─ [📋 Marquer prêt pour impression]
   └─ [🗑️ Supprimer] (si créateur)

🔴 À REVOIR
   └─ [📋 Marquer prêt pour impression]
```

---

## 🖨️ IMPRIMEUR (Roland / Xerox)

### Dossiers visibles
```
🟣 Prêt impression  →  🟦 En impression  →  🔷 Imprimé  →  🟣 Prêt livraison
```

### Boutons par statut
```
🟣 PRÊT IMPRESSION
   └─ [🖨️ Démarrer impression]
   └─ [🔄 Renvoyer à revoir] ⚠️

🟦 EN IMPRESSION
   └─ [✅ Marquer comme imprimé]
   └─ [🔄 Renvoyer à revoir] ⚠️

🔷 IMPRIMÉ (frontend only)
   └─ [📦 Marquer prêt livraison]
```

---

## 🚚 LIVREUR

### Dossiers visibles
```
🟣 Prêt livraison  →  🟣 En livraison  →  🟢 Livré  →  ⚪ Terminé
```

### Boutons par statut
```
🟣 PRÊT LIVRAISON
   └─ [🚚 Démarrer livraison]
   └─ [📦 Livrer directement] ⚠️ (manquant)

🟣 EN LIVRAISON
   └─ [✅ Marquer comme livré]

🟢 LIVRÉ
   └─ [🏁 Marquer comme terminé]
```

---

## 👑 ADMIN

### Dossiers visibles
```
TOUS LES STATUTS (9 statuts)
```

### Boutons
```
TOUS LES BOUTONS des autres rôles
+ [⚡ Forcer transition] (modal avec dropdown)
+ [◀️ Rollback] (retour arrière)
+ [🗑️ Supprimer] (n'importe quel dossier)
```

---

## 🎨 COULEURS DES STATUTS

```
🔵 nouveau           Bleu      
🟡 en_cours          Jaune     
🔴 a_revoir          Rouge     
🟣 pret_impression   Violet    
🟦 en_impression     Indigo    
🔷 imprime           Cyan      
🟣 pret_livraison    Violet    
🟣 en_livraison      Violet    
🟢 livre             Vert      
⚪ termine           Gris      
```

---

## ⚠️ PROBLÈMES CONNUS

| Symbole | Rôle | Statut | Bouton | Problème |
|---------|------|--------|--------|----------|
| ⚠️ | Préparateur | en_impression | Renvoyer à revoir | Affiché mais 403 |
| ⚠️ | Préparateur | pret_livraison | Renvoyer à revoir | Affiché mais 403 |
| ⚠️ | Imprimeur | pret_impression | Renvoyer à revoir | Affiché mais 403 |
| ⚠️ | Imprimeur | en_impression | Renvoyer à revoir | Affiché mais 403 |
| ⚠️ | Imprimeur | pret_livraison | Renvoyer à revoir | Affiché mais 403 |
| ⚠️ | Livreur | pret_livraison | Livrer directement | Manquant |

---

## 📊 WORKFLOW GLOBAL

```
┌─────────────┐
│   Nouveau   │ 🔵 Préparateur crée
└──────┬──────┘
       ↓
┌─────────────┐
│  En cours   │ 🟡 Préparateur prépare
└──────┬──────┘
       ↓
┌─────────────┐
│Prêt impress.│ 🟣 Imprimeur prend en charge
└──────┬──────┘
       ↓
┌─────────────┐
│En impression│ 🟦 Imprimeur imprime
└──────┬──────┘
       ↓
┌─────────────┐
│  Imprimé    │ 🔷 Impression terminée
└──────┬──────┘
       ↓
┌─────────────┐
│Prêt livraiso│ 🟣 Livreur prend en charge
└──────┬──────┘
       ↓
┌─────────────┐
│En livraison │ 🟣 Livraison en cours
└──────┬──────┘
       ↓
┌─────────────┐
│   Livré     │ 🟢 Client a reçu
└──────┬──────┘
       ↓
┌─────────────┐
│  Terminé    │ ⚪ Archivé
└─────────────┘

← À tout moment: "À revoir" 🔴 (retour préparateur)
```

---

## 🔔 QUI REÇOIT LES NOTIFICATIONS ?

| Événement | 📋 Prép. | 🖨️ Impr. | 🚚 Livr. | 👑 Admin |
|-----------|----------|----------|----------|----------|
| Créé | ✅ | ❌ | ❌ | ✅ |
| Prêt impression | ✅ | ✅ | ❌ | ✅ |
| En impression | ✅ | ✅ | ❌ | ✅ |
| Prêt livraison | ✅ | ✅ | ✅ | ✅ |
| À revoir | ✅ | ❌ | ❌ | ✅ |
| Livré | ✅ | ❌ | ✅ | ✅ |
| Terminé | ✅ | ❌ | ❌ | ✅ |

---

**Voir `ROLES_BOUTONS_STATUTS_PLATEFORME.md` pour version détaillée**
