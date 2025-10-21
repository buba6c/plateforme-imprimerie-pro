# ⚡ COMMANDES RAPIDES - FIX ESTIMATION 0 FCFA

## 🚀 Redémarrer les Services

```bash
# Backend
pm2 restart imprimerie-backend

# Frontend
pm2 restart imprimerie-frontend

# Les deux
pm2 restart all
```

## 🧪 Tests Rapides

```bash
# Tous les supports Roland
node test-all-supports.js

# Xerox
node test-xerox-estimation.js

# IA (Roland + Xerox)
node test-ia-estimation.js

# Test Complet Final
node test-complete-final.js
```

## 📊 Vérifier les Logs

```bash
# Backend - Tout
pm2 logs imprimerie-backend

# Backend - Dernières 50 lignes
pm2 logs imprimerie-backend --lines 50 --nostream

# Backend - Uniquement les mappings
pm2 logs imprimerie-backend --nostream | grep "Roland Support"

# Backend - Erreurs seulement
pm2 logs imprimerie-backend --nostream | grep "❌"
```

## 🔧 Éditer les Mappings

```bash
# Ouvrir le fichier de mapping
code backend/utils/tariffMapping.js

# Les maps principales:
# - ROLAND_SUPPORT_MAP (ligne ~9)
# - XEROX_DOCUMENT_MAP (ligne ~23)
# - XEROX_FORMAT_MAP (ligne ~33)
# - XEROX_GRAMMAGE_MAP (ligne ~53)
# - XEROX_COULEUR_MAP (ligne ~63)
# - FINITION_MAP (ligne ~75)
```

## 📚 Audit des Tarifs

```bash
# Voir tous les tarifs Roland
node audit-xerox-tarifs.js

# Query directe
node -e "
const dbHelper = require('./backend/utils/dbHelper');
(async () => {
  const [t] = await dbHelper.query(
    'SELECT cle, label, valeur FROM tarifs_config WHERE type_machine = \$1',
    ['roland']
  );
  t.forEach(x => console.log(\`\${x.cle}: \${x.label} = \${x.valeur}\`));
})();
"
```

## 🧮 Tester un Prix

```bash
# Test Roland simple
curl -X POST http://localhost:5001/api/devis/estimate-realtime \
  -H "Content-Type: application/json" \
  -d '{
    "formData": {
      "type_support": "Bâche",
      "largeur": 200,
      "hauteur": 300,
      "unite": "cm"
    },
    "machineType": "roland"
  }'

# Résultat attendu: { prix_estime: 42000, ... }
```

## 📈 Performance

```bash
# Vérifier la vitesse
time node test-complete-final.js

# Affichage avec temps
pm2 logs imprimerie-backend --nostream | grep "ms)"
```

## 🔍 Debugging

```bash
# Si prix = 0 FCFA:
# 1. Vérifier les logs
pm2 logs imprimerie-backend | grep "Roland Support"

# 2. Vérifier le mapping
node -e "
const m = require('./backend/utils/tariffMapping');
console.log(m.mapRolandSupport('Bâche'));  // Doit afficher: bache_m2
"

# 3. Vérifier les tarifs en DB
node -e "
const db = require('./backend/utils/dbHelper');
(async () => {
  const [t] = await db.query(
    'SELECT * FROM tarifs_config WHERE cle = \$1',
    ['bache_m2']
  );
  console.log(t[0]);  // Doit afficher le tarif
})();
"
```

## 📋 Checklist

- [ ] Backend restarté après modifications
- [ ] Tests passent: `node test-complete-final.js`
- [ ] Logs montrent le mapping: `grep "Roland Support" logs`
- [ ] Prix > 0 FCFA pour tous les tests
- [ ] Performance < 10ms

## ⚠️ Problèmes Courants

### Prix affiche 0 FCFA
1. Backend n'a pas été restarté
2. Mapping manquant pour le support
3. Clé de tarif n'existe pas en base

### Solution:
```bash
pm2 restart imprimerie-backend
node test-complete-final.js
pm2 logs imprimerie-backend
```

### Cache bloque les nouvelles estimations
```bash
# Vider le cache
node -e "
const cache = require('node-cache');
const c = new cache({ stdTTL: 300 });
c.flushAll();
console.log('✅ Cache vidé');
"
# Ou: Redémarrer le backend
pm2 restart imprimerie-backend
```

## 📞 Support Rapide

**Q: Comment ajouter un nouveau support?**
```javascript
// Dans backend/utils/tariffMapping.js, ajouter:
const ROLAND_SUPPORT_MAP = {
  'Nouveau Support': 'new_support_m2',  // ← Ajouter ici
  // ...
};
```

**Q: Comment tester rapidement?**
```bash
node test-complete-final.js
```

**Q: Où voir les calculs détaillés?**
```bash
pm2 logs imprimerie-backend | grep -E "Roland Support|Tarif trouvé|Estimation calculée"
```

---

**Dernière mise à jour**: 18 Octobre 2025
**Version**: 1.0
**Status**: ✅ Production Ready
