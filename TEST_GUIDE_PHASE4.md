# 🧪 GUIDE DE TEST - VÉRIFIER L'IA EN PRODUCTION

**Durée:** 10-15 min  
**Complexité:** Facile  
**Résultat:** Vérifier que tout fonctionne  

---

## ✅ Pre-Flight Checks

### 1. Vérifier les services

```bash
# Terminal: Vérifier les processus
pm2 status

Expected output:
✓ imprimerie-backend: online (fork, memory: 50mb+)
✓ imprimerie-frontend: online (fork, memory: 50mb+)
```

### 2. Vérifier les ports

```bash
# Backend
curl -s http://localhost:5001/api/health | jq .
Expected: {"status": "ok"}

# Frontend  
curl -s http://localhost:3001 | grep -i "evocomprint"
Expected: HTML page loaded
```

### 3. Vérifier les endpoints IA

```bash
# Endpoint analyse devis
curl -X POST http://localhost:5001/api/devis/analyze-description \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "description": "500 flyers A5",
    "client_name": "Test Client",
    "contact": "test@example.com"
  }'

Expected: 
{
  "proposals": [3 proposals],
  "confidence_score": 0.95,
  "thinking_process": [5 steps],
  "product_type": "Flyer",
  "total_ht": 2450
}
```

---

## 🎮 Test 1: CreateDossier avec IA

### Etapes

1. **Ouvrir navigateur**
   ```
   URL: http://localhost:3001
   ```

2. **Naviguer vers Créer Dossier**
   ```
   Menu → "Créer un dossier"
   ou clic sur bouton "+ Nouveau dossier"
   ```

3. **Voir le bouton IA**
   ```
   Regarder section "Presets rapides"
   Doit avoir bouton "🤖 Suggestions IA"
   
   Position: À côté des presets
   Couleur: Purple/violet
   ```

4. **Cliquer le bouton**
   ```
   Clic sur "🤖 Suggestions IA"
   → Modal doit s'ouvrir à droite
   ```

5. **Entrer description**
   ```
   Dans la modale, voir:
   - Champ pour description
   - Bouton "Analyser"
   - Zone pour suggestions
   ```

6. **Tester suggestions**
   ```
   Description: "500 flyers A5 couleur"
   Clic "Analyser"
   
   Attendre ~1-2 secondes
   
   Doit voir:
   - ✓ Confiance: 95%
   - 5 étapes d'analyse
   - 3 propositions (Premium/Standard/Eco)
   ```

7. **Appliquer suggestion**
   ```
   Clic sur une proposition
   → Modal se ferme
   → Formulaire auto-rempli
   
   Vérifier:
   - type_document rempli ✓
   - nombre_exemplaires: 500 ✓
   - prix estimé visible ✓
   ```

8. **Créer dossier**
   ```
   Remplir client (si pas rempli)
   Clic "Créer le dossier"
   
   Attendre succès
   → Notification "Dossier créé"
   ```

### Résultat Attendu

✅ **Test réussi** si:
- [ ] Bouton IA visible et cliquable
- [ ] Modal s'ouvre sans erreur
- [ ] Suggestions apparaissent (confiance 95%)
- [ ] 5 étapes visibles
- [ ] 3 propositions affichées
- [ ] Appliquer remplit les champs
- [ ] Dossier créé sans erreur
- [ ] Temps total: < 1 min

---

## 🎮 Test 2: DevisList avec Conformité

### Etapes

1. **Ouvrir DevisList**
   ```
   Menu → "Mes devis"
   ```

2. **Voir les badges**
   ```
   Ouvrir liste de devis
   
   Chaque devis doit avoir:
   - Numéro
   - Statut (Brouillon/Validé/etc)
   - Machine (Roland/Xerox)
   - BADGE CONFORMITÉ ← NEW!
   
   Badge possible values:
   - ✓ Conforme (vert)
   - ⚠️ À vérifier (jaune)
   ```

3. **Vérifier chargement**
   ```
   Les badges doivent apparaître ~1-2 sec après
   après chargement de la liste
   ```

4. **Hovrer sur badge**
   ```
   Survol souris sur badge
   → Tooltip doit apparaître
   → Message avec détails (ex: "Conforme, OK conversion")
   ```

5. **Vérifier couleurs**
   ```
   Green (✓ Conforme):
   - Clairs et positifs
   - Indiquent OK pour conversion
   
   Yellow (⚠️ À vérifier):
   - Attention
   - Ont peut-être besoin optimisation
   ```

### Résultat Attendu

✅ **Test réussi** si:
- [ ] Badges visibles sur tous les devis
- [ ] Chargement < 2 secondes
- [ ] Couleurs correctes (vert/jaune)
- [ ] Tooltips au survol
- [ ] Messages pertinents
- [ ] Pas d'erreurs console

---

## 📊 Test 3: Performance

### Mesures

#### Temps de réponse - API

```bash
# Tester analyse devis
time curl -X POST http://localhost:5001/api/devis/analyze-description \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"description": "test", "client_name": "test"}'

Expected: < 1.5 secondes
```

#### Temps de chargement - Frontend

```bash
# Ouvrir DevTools (F12)
# Onglet Network
# Ouvrir CreateDossier
# Voir timing

Expected:
- DOMContentLoaded: < 1s
- Fully loaded: < 3s
- Main JS bundle: < 500ms
```

#### Chargement conformité

```bash
# Ouvrir DevisList
# Voir quand badges apparaissent

Expected:
- Page charge: 1s
- Badges apparaissent: +1-2s
- Total: < 3 secondes
```

### Résultat Attendu

✅ **Performance acceptée** si:
- [ ] Analyse devis: < 1.5s
- [ ] Page load: < 3s
- [ ] Badges: < 2s après charge
- [ ] CPU: < 50%
- [ ] Memory: < 100mb

---

## 🐛 Test 4: Edge Cases

### Erreurs Expected (et OK)

1. **Sans token auth**
   ```
   Erreur: 401 Unauthorized
   Status: ✓ OK (sécurité)
   ```

2. **Description vide**
   ```
   Erreur: "Description required"
   Status: ✓ OK (validation)
   ```

3. **Réseau slow**
   ```
   Loading spinner affiche
   Attendre jusqu'à 5 secondes
   Puis afficher résultats
   Status: ✓ OK (fallback)
   ```

4. **IA indisponible**
   ```
   Message: "AI service unavailable"
   Formulaire: Reste utilisable
   Status: ✓ OK (graceful degradation)
   ```

### Résultat Attendu

✅ **Erreur handling correct** si:
- [ ] Messages d'erreur clairs
- [ ] Pas de crash UI
- [ ] Fallback fonctionnels
- [ ] Graceful degradation

---

## 📋 Checklist Complète de Test

### Frontend
```
UI Components:
☐ CreateDossier se charge
☐ Bouton IA visible
☐ Modal IA s'ouvre
☐ IAOptimizationPanel affiche suggestions
☐ DevisList se charge
☐ Badges visibles
☐ Tooltips fonctionnent
☐ Dark mode OK

Interactions:
☐ Bouton IA cliquable
☐ Modal ferme proprement
☐ Suggestions cliquables
☐ Form auto-remplissage
☐ Création dossier
☐ Badge selection
☐ Hover tooltips
```

### API
```
Endpoints:
☐ /api/devis/analyze-description → 200
☐ /api/ai-agent/analyze → 200
☐ /api/ai-agent/compliance → 200
☐ Auth headers validés
☐ Errors handled

Response Data:
☐ JSON valide
☐ Fields requis présents
☐ Confiance > 90%
☐ Proposals valides
☐ Compliance scores corrects
```

### Performance
```
☐ Load < 3s
☐ API response < 1.5s
☐ Badges < 2s
☐ Memory < 100mb
☐ CPU < 50%
☐ No memory leaks
```

### Stability
```
☐ No console errors
☐ No warnings critiques
☐ Pas de crash
☐ Process online
☐ Logs clean
```

---

## 📸 Screenshots pour Verification

### Expected: CreateDossier Modal
```
┌─ 💡 Suggestions IA ────────────────────┐
│                                          │
│ Description: [input field]              │
│ [🔍 Analyser button]                    │
│                                          │
│ ✅ Confiance: ████████░░ 95%            │
│                                          │
│ 5 Steps:                                 │
│ 1. Parse user input ✓                   │
│ 2. Analyze options ✓                    │
│ 3. Evaluate solutions ✓                 │
│ 4. Calculate proposals ✓                │
│ 5. Verify feasibility ✓                 │
│                                          │
│ Suggestions:                             │
│ □ Premium - 500 FL A5 - 2950F  [Apply] │
│ □ Standard - 500 FL A5 - 2450F [Apply] │
│ □ Eco - 500 FL A5 - 1950F      [Apply] │
│                                          │
│ [✕ Fermer]                              │
└──────────────────────────────────────────┘
```

### Expected: DevisList Badges
```
✓ Devis_001 ✓ Conforme Xerox [Actions]
✓ Devis_002 ⚠️ À vérifier  Roland [Actions]
✓ Devis_003 ✓ Conforme Xerox [Actions]
✓ Devis_004 ⚠️ À vérifier  Xerox [Actions]
```

---

## 🎯 Success Criteria

### Must Have ✅
- [ ] DevisList badges visible
- [ ] CreateDossier bouton IA fonctionne
- [ ] Suggestions intelligentes affichées
- [ ] Auto-remplissage marche
- [ ] Pas d'erreur critique
- [ ] Performance acceptable

### Should Have 🟡
- [ ] Tooltips au survol
- [ ] Animation smooth
- [ ] Dark mode support
- [ ] Mobile responsive

### Nice to Have ⭐
- [ ] Suggestions très pertinentes
- [ ] Taux acceptation > 80%
- [ ] Performance excellent < 1s
- [ ] Zero bugs trouvés

---

## 📞 Troubleshooting

### Problème: Bouton IA pas visible
**Solution:** 
- Rafraîchir page (F5)
- Vérifier console (F12)
- Vérifier build réussi

### Problème: Suggestions pas affichées
**Solution:**
- Vérifier internet connection
- Vérifier backend running
- Checker logs: `pm2 logs imprimerie-backend`

### Problème: Badges pas chargés
**Solution:**
- Attendre 2-3 secondes de plus
- Rafraîchir liste
- Vérifier erreurs console

### Problème: Form pas auto-rempli
**Solution:**
- Vérifier données proposition
- Click sur "Apply" (pas select)
- Vérifier pas d'erreurs JS

---

## 🚀 Final Check

```
Before marking DONE:

1. Frontend UP ✓
   pm2 logs imprimerie-frontend --nostream | grep "online"

2. Backend UP ✓
   curl http://localhost:5001/api/health

3. CreateDossier works ✓
   Click "🤖 Suggestions IA" → No errors

4. DevisList works ✓
   See badges on all devis

5. No critical errors ✓
   Check console (F12) → No red errors

6. Performance OK ✓
   Network tab → APIs < 1.5s

Status: ✅ READY FOR USE
```

---

**Test Duration:** 10-15 minutes  
**Expected Result:** ALL TESTS PASS ✅  
**Status:** Ready for Production 🚀
