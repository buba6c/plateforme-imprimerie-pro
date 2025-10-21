# 🔍 DIAGNOSTIC: Estimation 0 FCFA

## Problème Identifié
✅ Les tarifs sont en base de données  
✅ L'API est appelée correctement  
✅ Mais l'estimation retourne 0 FCFA

## Cause Racine
**MISMATCH ENTRE LES DONNÉES DU FORMULAIRE ET LES CLÉS DES TARIFS**

### Exemple:
```javascript
// Ce que le formulaire envoie:
{
  support: "Bâche"  // ← Majuscule + accent
}

// Ce que les tarifs attendaient:
{
  cle: "bache_m2"   // ← Minuscule + pas d'accent + suffixe
}

// Résultat:
"Bâche" !== "bache_m2"  → Pas de match → Prix = 0
```

---

## ✅ Tarifs Disponibles en Base

### Roland - Support (m²):
| Clé | Label | Tarif |
|-----|-------|-------|
| `bache_m2` | Bâche standard | 7000 FCFA |
| `vinyle_m2` | Vinyle | ? |
| `tissu_m2` | Tissu | ? |

### Xerox - Papier (par page):
| Clé | Label | Tarif |
|-----|-------|-------|
| `a4_80g` | A4 80g | ? |
| `a5_80g` | A5 80g | ? |

---

## Solutions Possibles

### SOLUTION 1: Normaliser les données du formulaire
Avant d'envoyer les données à l'API, les convertir en minuscules + sans accents:

```javascript
// Dans DevisCreation.js
const normalizeFormData = (formData, machineType) => {
  const normalized = { ...formData };
  
  if (machineType === 'roland') {
    // Convertir support en clé de tarif
    const supportMap = {
      'Bâche': 'bache_m2',
      'Vinyle': 'vinyle_m2',
      'Tissu': 'tissu_m2',
      // ...
    };
    normalized.support = supportMap[formData.support] || formData.support;
  }
  
  return normalized;
};

// Avant d'envoyer:
const result = await axios.post(
  `${API_URL}/devis/estimate-realtime`,
  { 
    formData: normalizeFormData(rolandData, machineType),  // ← Normalisé!
    machineType 
  },
  { headers: { Authorization: `Bearer ${token}` } }
);
```

### SOLUTION 2: Améliorer le matching dans le backend
Modifier la recherche de tarif pour être plus flexible:

```javascript
// Dans realtimeEstimationService.js
const findTarif = (support, tarifs) => {
  // Normaliser la recherche
  const normalized = support.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');  // Enlever les accents
  
  return tarifs.find(t => {
    const tarifNorm = t.cle.toLowerCase();
    return normalized.includes(tarifNorm) || tarifNorm.includes(normalized);
  });
};
```

### SOLUTION 3: Créer une table de mapping (MEILLEURE SOLUTION)
```sql
CREATE TABLE IF NOT EXISTS support_mapping (
  id SERIAL PRIMARY KEY,
  display_name VARCHAR(100),  -- "Bâche"
  tarif_cle VARCHAR(50),      -- "bache_m2"
  machine_type VARCHAR(20),
  UNIQUE(display_name, machine_type)
);

INSERT INTO support_mapping (display_name, tarif_cle, machine_type) VALUES
('Bâche', 'bache_m2', 'roland'),
('Vinyle', 'vinyle_m2', 'roland'),
('Tissu', 'tissu_m2', 'roland'),
-- ... etc
```

---

## 🔧 Action Immédiate Requise

### Étape 1: Vérifier les correspondances exactes
```javascript
// Exécuter ce code pour voir TOUTES les clés disponibles:
const dbHelper = require('./backend/utils/dbHelper');

(async () => {
  const [tarifs] = await dbHelper.query(
    'SELECT DISTINCT cle FROM tarifs_config WHERE actif = TRUE'
  );
  console.log('Clés de tarifs disponibles:', tarifs.map(t => t.cle));
})();
```

### Étape 2: Mapper les valeurs du formulaire
Créer un fichier `supportMap.js`:
```javascript
// backend/utils/supportMap.js
const SUPPORT_MAP = {
  // Roland supports
  'Bâche': 'bache_m2',
  'Vinyle': 'vinyle_m2',
  'Vinyle Transparent': 'vinyle_transparent_m2',
  'Micro-perforé': 'micro_perfore_m2',
  'Tissu': 'tissu_m2',
  'Backlit': 'backlit_m2',
  'Mesh': 'mesh_m2',
  'Pré-découpe': 'pre_decoupe_m2',
  'Kakemono': 'kakemono_m2',
  // ... autres
};

const DOCUMENT_MAP = {
  // Xerox documents
  'Carte de visite': 'cv_',
  'Flyer': 'flyer_',
  // ... autres
};

module.exports = { SUPPORT_MAP, DOCUMENT_MAP };
```

### Étape 3: L'utiliser dans l'estimation
```javascript
// Dans realtimeEstimationService.js
const { SUPPORT_MAP } = require('../utils/supportMap');

const tarifCle = SUPPORT_MAP[formData.support] || formData.support;
const tarifSupport = tarifs.find(t => t.cle === tarifCle);
```

---

## 📊 État Actuel vs Attendu

### État Actuel (BOGUE):
```
User selects: "Bâche"
      ↓
Send to API: support = "Bâche"
      ↓
Search DB: WHERE cle = "Bâche"  ← NON TROUVÉ!
      ↓
Prix = 0 FCFA  ❌
```

### État Attendu (CORRIGÉ):
```
User selects: "Bâche"
      ↓
Normalize: support = "bache_m2"
      ↓
Send to API: support = "bache_m2"
      ↓
Search DB: WHERE cle = "bache_m2"  ← TROUVÉ!
      ↓
Prix = 7000 FCFA * surface  ✅
```

---

## ⚠️ IMPACT

| Composant | Statut | Impact |
|-----------|--------|--------|
| API | ✅ Fonctionne | Retourne 0 au lieu de prix correct |
| DB | ✅ A les données | Les clés ne correspondent pas |
| Frontend | ✅ Affiche résultat | Affiche 0 au lieu du prix |
| UX | ❌ Cassée | L'estimation est inutile avec 0 |

---

## 🎯 Priorité: 🔴 HAUTE

**Sans cette correction**, l'estimation temps réel est inutile (montre toujours 0).

---

**Recommandation**: Implémenter la SOLUTION 3 (table de mapping) pour une solution robuste et extensible.

---

Generated: 18 Octobre 2025  
Status: 🔴 ISSUE IDENTIFIÉE
