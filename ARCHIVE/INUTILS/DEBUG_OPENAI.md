# 🔍 DEBUG - Configuration OpenAI

**Date**: 2025-10-09 19:11  
**Problème**: Erreur lors de la sauvegarde OpenAI

---

## 🧪 PROCÉDURE DE TEST

### Étape 1: Essayer de sauvegarder
1. Allez dans l'interface OpenAI
2. Ajoutez du texte dans "Base de connaissance"
3. Cliquez sur "Sauvegarder"

### Étape 2: Vérifier les logs en temps réel
```bash
pm2 logs imprimerie-backend --lines 0
```

**Recherchez**:
- 📝 Body reçu: {...}
- 🔐 Chiffrement de la clé API...
- 📚 Mise à jour knowledge base...
- ⚙️ Mise à jour is_active: ...
- 🔍 Updates: [...]
- 🔍 Params: [...]
- 🔍 Query: UPDATE openai_config...
- ✅ Mise à jour réussie

**Ou des erreurs**:
- ❌ Erreur PUT OpenAI: ...

---

## 🔧 CORRECTIONS POSSIBLES

### Si "WHERE id = 1" ne trouve rien
**Problème**: La table n'a pas de ligne avec id=1

**Solution**:
```sql
INSERT INTO openai_config (is_active) VALUES (FALSE) 
ON CONFLICT DO NOTHING;
```

### Si "column does not exist"
**Problème**: Structure de table incorrecte

**Solution**: Vérifier la structure
```sql
\d openai_config
```

### Si "permission denied"
**Problème**: Droits PostgreSQL

**Solution**: Vérifier les permissions

---

## 📊 TESTS MANUELS

### Test 1: Vérifier que la ligne existe
```bash
cd /Users/mac/Documents/PLATEFOME/code_backup_20251003_131151/backend
node -e "
const dbHelper = require('./utils/dbHelper');
dbHelper.query('SELECT * FROM openai_config WHERE id = 1')
  .then(([rows]) => {
    if (rows.length > 0) {
      console.log('✅ Ligne trouvée:', rows[0]);
    } else {
      console.log('❌ Aucune ligne avec id=1');
      console.log('💡 Exécutez: INSERT INTO openai_config (is_active) VALUES (false)');
    }
  })
  .catch(err => console.error('❌ Erreur:', err.message));
"
```

### Test 2: Faire un UPDATE manuel
```bash
node -e "
const dbHelper = require('./utils/dbHelper');
dbHelper.query(
  'UPDATE openai_config SET knowledge_base_text = ? WHERE id = 1',
  ['Test manuel']
)
  .then(() => console.log('✅ UPDATE réussi'))
  .catch(err => console.error('❌ Erreur:', err.message));
"
```

---

## 🎯 SOLUTIONS RAPIDES

### Solution 1: S'assurer qu'une ligne existe
```bash
cd /Users/mac/Documents/PLATEFOME/code_backup_20251003_131151/backend
PGPASSWORD="imprimerie_password" psql -h localhost -U imprimerie_user -d imprimerie_db -c "
INSERT INTO openai_config (is_active) 
SELECT FALSE 
WHERE NOT EXISTS (SELECT 1 FROM openai_config WHERE id = 1);
"
```

### Solution 2: Vérifier la structure
```bash
PGPASSWORD="imprimerie_password" psql -h localhost -U imprimerie_user -d imprimerie_db -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'openai_config';
"
```

---

## 📝 CHECKLIST

- [ ] Backend redémarré avec logs
- [ ] Essayé de sauvegarder dans l'interface
- [ ] Vérifié les logs pm2
- [ ] Testé que la ligne id=1 existe
- [ ] Testé UPDATE manuel
- [ ] Vérifié structure de table

---

## 💡 CE QUI A ÉTÉ FAIT

✅ Ajout de logs détaillés dans `routes/openai-config.js`
✅ Backend redémarré

**Prochaine étape**: Essayer de sauvegarder et regarder les logs !

---

**Debug par**: Agent Mode AI  
**Date**: 2025-10-09 19:11
