# 🚀 GUIDE DE TEST: Estimation en Temps Réel

## 🎯 Objectif
Vérifier que l'estimation en temps réel s'affiche bien quand vous créez un devis.

---

## ✅ CHECKLIST DE TEST

### ÉTAPE 1: Naviguer au formulaire
- [ ] Ouvrir l'application
- [ ] Aller à **Onglet Devis**
- [ ] Cliquer **"Créer un devis"**
- [ ] Sélectionner **"Formulaire détaillé"** (première option)

### ÉTAPE 2: Choisir une machine
- [ ] Cliquer **"Roland (Grand Format)"** OU **"Xerox (Numérique)"**

### ÉTAPE 3: Remplir le formulaire

**Pour ROLAND:**
```
1. Nom du client: "Client Test" ✓
2. Type de support: Sélectionner "Bâche" ✓
3. Largeur: Entrer "200" ✓
4. Hauteur: Entrer "300" ✓
5. Unité: "cm" (par défaut) ✓
```

**Pour XEROX:**
```
1. Nom du client: "Client Test" ✓
2. Type de document: Sélectionner "Flyer" ✓
3. Format: Sélectionner "A4" ✓
4. Nombre d'exemplaires: "1000" ✓
```

### ÉTAPE 4: Observer l'estimation
- [ ] Après 0-1 secondes, une **boîte verte** doit apparaître
- [ ] Elle affiche un **prix en FCFA**
- [ ] Elle montre **le temps de calcul** (ex: "245ms")

---

## 🔍 CE QUE VOUS DEVRIEZ VOIR

### Position: 
```
Juste APRÈS les informations client
Juste AVANT les spécifications Roland/Xerox
```

### Apparence:
```
┌─────────────────────────────────────────┐
│ 💰 Estimation                          │
│                                         │
│ 150 000 FCFA                           │
│                                         │
│ ⚡ Calcul: 245ms      ✓ En temps réel │
└─────────────────────────────────────────┘
```

---

## 🐛 Si vous ne voyez PAS l'estimation

### Vérifier 1: Les champs obligatoires
```javascript
Roland:
  - Type de support: Doit être sélectionné
  - Largeur: Doit avoir une valeur
  - Hauteur: Doit avoir une valeur

Xerox:
  - Type de document: Doit être sélectionné
  - Format: Doit être sélectionné
  - Nombre d'exemplaires: Doit avoir une valeur
```

### Vérifier 2: La console du navigateur
```bash
1. Appuyer F12
2. Aller à l'onglet "Console"
3. Chercher des erreurs rouges
4. Si vous voyez "POST /api/devis/estimate-realtime", c'est bon!
```

### Vérifier 3: L'onglet Network
```bash
1. Appuyer F12
2. Aller à l'onglet "Network"
3. Remplir le formulaire
4. Chercher "estimate-realtime"
5. Vérifier que le statut est "200" (succès)
```

### Vérifier 4: Le serveur backend
```bash
# Vérifier que le backend tourne:
pm2 status

# Voir les logs du backend:
pm2 logs imprimerie-backend --lines 50 | grep estimate-realtime
```

---

## 🎬 ÉTAPES COMPLÈTES

### Scénario ROLAND:
```
1. Devis → Créer devis
2. Choisir "Formulaire détaillé"
3. Choisir "Roland"
4. Remplir:
   - Nom: "Test Roland"
   - Support: "Bâche"
   - Largeur: "200"
   - Hauteur: "150"
5. ✓ Vous devez voir une estimation!
```

### Scénario XEROX:
```
1. Devis → Créer devis
2. Choisir "Formulaire détaillé"
3. Choisir "Xerox"
4. Remplir:
   - Nom: "Test Xerox"
   - Type: "Flyer"
   - Format: "A5"
   - Exemplaires: "2000"
5. ✓ Vous devez voir une estimation!
```

---

## 📊 POINTS À TESTER

| Point | Test | Résultat |
|-------|------|---------|
| Affichage initial | Voir le texte "Complétez les champs..." | ✓/❌ |
| Champs obligatoires | Remplir largeur et hauteur (Roland) | ✓/❌ |
| Estimation apparaît | Voir la boîte verte après 1 sec | ✓/❌ |
| Prix affiché | Voir un nombre en FCFA | ✓/❌ |
| Temps de calcul | Voir la durée du calcul | ✓/❌ |
| Changement de valeur | Modifier la largeur → Prix change | ✓/❌ |
| Debounce fonctionne | Pas d'appel API à chaque keystroke | ✓/❌ |
| Cache fonctionne | Même données → "Depuis le cache" | ✓/❌ |

---

## 💡 ASTUCE POUR LE DEBUG

### Voir exactement ce qui se passe:

1. **Ouvrir la console (F12)**
2. **Ajouter ce code dans la console:**
```javascript
// Voir tous les appels POST
const originalPost = fetch;
window.fetch = function(...args) {
  if (args[0].includes('estimate-realtime')) {
    console.log('🔴 API CALL:', args[0], args[1]);
  }
  return originalPost.apply(this, args);
};
```

3. **Remplir le formulaire et regarder les logs**

---

## ✅ SUCCÈS

Vous verrez cet écran:

```
┌────────────────────────────────────────────────────┐
│                                                    │
│ 📋 Informations Client                            │
│ ├─ Nom du client: "Test Roland"                   │
│ └─ Contact: ...                                   │
│                                                    │
│ ✨ ESTIMATION EN TEMPS RÉEL ← NEW!                │
│ ┌────────────────────────────────────────────────┐│
│ │ 💰 Estimation                                  ││
│ │                                                ││
│ │ 150 000 FCFA                                   ││
│ │                                                ││
│ │ ⚡ Calcul: 245ms      ✓ En temps réel         ││
│ └────────────────────────────────────────────────┘│
│                                                    │
│ 🖨️ Spécifications Roland                          │
│ ├─ Type de support: "Bâche"                      │
│ ├─ Largeur: "200"                                │
│ ├─ Hauteur: "150"                                │
│ └─ ...                                           │
│                                                    │
│ [Annuler]  [Créer le devis] ← avec prix visible  │
└────────────────────────────────────────────────────┘
```

---

## 🎉 RÉSULTAT ATTENDU

✅ **SUCCÈS**: L'estimation s'affiche en temps réel quand vous remplissez le formulaire
❌ **ÉCHEC**: L'estimation ne s'affiche pas

---

**Date**: 18 Octobre 2025  
**Testeur**: Vous  
**Ticket**: Estimation Temps Réel

👉 **Prêt à tester? Allez-y!**
