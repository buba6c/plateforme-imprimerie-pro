# ⚡ COMMANDES RAPIDES - IA INTELLIGENTE

## 🎯 Essentiels

```bash
# ✅ Vérifier que tout fonctionne
pm2 list

# 🌐 Accéder à l'interface
# http://localhost:3001/ia-devis

# 🔄 Redémarrer si besoin
pm2 restart imprimerie-backend
pm2 restart imprimerie-frontend
```

## 🧪 Tests Rapides

```bash
# TEST 1: Page charge
curl -s http://localhost:3001/ia-devis | head -1

# TEST 2: API répond
curl -s -X POST http://localhost:5001/api/ai-agent/analyze \
  -H "Content-Type: application/json" \
  -d '{"request": "100 xerox"}' | jq '.success'

# TEST 3: Context disponible
curl -s http://localhost:5001/api/ai-agent/context | jq '.context.xerox_tariffs_count'

# TEST 4: Suite complète
cd /Users/mac/Documents/PLATEFOME/IMP\ PLATEFORM
node test-ia-intelligent.js
```

## 📊 Logs

```bash
# Voir les logs backend
pm2 logs imprimerie-backend --lines 50

# Voir les logs frontend
pm2 logs imprimerie-frontend --lines 50

# Suivi en temps réel
pm2 logs imprimerie-backend
```

## 🗄️ Database

```bash
# Vérifier tarifs
PGPASSWORD="PostgreSQL2024!" psql -h localhost \
  -U imprimerie_user -d imprimerie_db \
  -c "SELECT COUNT(*) as count FROM tarifs_xerox;" \
  2>&1 | grep -A1 "count"

# Voir les tarifs
PGPASSWORD="PostgreSQL2024!" psql -h localhost \
  -U imprimerie_user -d imprimerie_db \
  -c "SELECT * FROM tarifs_xerox LIMIT 5;" \
  2>&1

# Recharger tarifs
cd /Users/mac/Documents/PLATEFOME/IMP\ PLATEFORM
NODE_PATH=. node setup-tariffs.js
```

## 🚀 Santé Générale

```bash
# Status complet
pm2 show imprimerie-backend
pm2 show imprimerie-frontend

# Ressources utilisées
pm2 monit

# URLs de test rapide
echo "Frontend: http://localhost:3001"
echo "Backend: http://localhost:5001"
echo "IA: http://localhost:3001/ia-devis"
```

## 🎯 Voilà!

C'est tout ce que vous avez besoin de savoir pour utiliser l'IA.
