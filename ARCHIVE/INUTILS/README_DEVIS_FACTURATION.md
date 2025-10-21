# 💰 Module Devis & Facturation avec IA OpenAI

## 📋 Vue d'ensemble

Ce module ajoute un système complet de gestion de devis et facturation avec estimation intelligente via OpenAI à la plateforme EvocomPrint.

### ✨ Fonctionnalités principales

#### Pour les Préparateurs
- ✅ Créer des devis Roland ou Xerox
- ✅ Estimation automatique des prix (avec ou sans IA)
- ✅ Convertir un devis en dossier d'impression
- ✅ Consulter ses devis et factures
- ✅ Télécharger les PDF

#### Pour les Administrateurs
- ✅ Vue globale de tous les devis et factures
- ✅ Gestion des tarifs (Roland, Xerox, options)
- ✅ Configuration de l'API OpenAI
- ✅ Upload d'une base de connaissance tarifaire (PDF)
- ✅ Optimisation des tarifs via IA

#### Automatisations
- ✅ Numérotation automatique (DEV-2025-001, FAC-2025-001)
- ✅ Génération de facture à la livraison
- ✅ Calcul automatique HT/TVA
- ✅ Historique complet des modifications

---

## 🚀 Installation

### 1. Exécuter le script d'installation

```bash
./install-devis-facturation.sh
```

Ce script va :
- Installer les dépendances npm (openai, pdfkit, multer, uuid)
- Créer les dossiers nécessaires
- Générer une clé de chiffrement

### 2. Exécuter la migration SQL

```bash
mysql -u root -p plateforme_impression < backend/database/migrations/002_devis_facturation.sql
```

Ou via phpMyAdmin :
1. Ouvrir le fichier `backend/database/migrations/002_devis_facturation.sql`
2. Copier tout le contenu
3. Exécuter dans phpMyAdmin

### 3. Mettre à jour server.js

Ouvrir `backend/server.js` et ajouter après les autres routes :

```javascript
// Routes Devis & Facturation
const devisRoutes = require('./routes/devis');
const facturesRoutes = require('./routes/factures');
const tarifsRoutes = require('./routes/tarifs');
const openaiConfigRoutes = require('./routes/openai-config');

app.use('/api/devis', devisRoutes);
app.use('/api/factures', facturesRoutes);
app.use('/api/tarifs', tarifsRoutes);
app.use('/api/settings/openai', openaiConfigRoutes);
```

### 4. Redémarrer le serveur

```bash
# Si vous utilisez npm
npm run dev

# Si vous utilisez pm2
pm2 restart backend
```

---

## 📊 Structure de la base de données

### Tables créées

| Table | Description |
|-------|-------------|
| `devis` | Stockage des devis créés |
| `factures` | Factures générées |
| `tarifs_config` | Configuration des tarifs |
| `openai_config` | Configuration OpenAI |
| `devis_historique` | Audit trail |

### Vues créées

| Vue | Description |
|-----|-------------|
| `v_devis_complet` | Devis avec infos utilisateur |
| `v_factures_complet` | Factures avec infos complètes |
| `v_stats_devis_user` | Statistiques par utilisateur |

---

## 🔐 Configuration OpenAI

### 1. Obtenir une clé API

1. Créer un compte sur [platform.openai.com](https://platform.openai.com)
2. Générer une clé API
3. Se connecter en tant qu'admin sur la plateforme
4. Aller dans **Paramètres** → **OpenAI & Estimation intelligente**
5. Coller la clé API et tester la connexion

### 2. Base de connaissance (optionnel)

Deux options :

#### Option A : Texte libre
Écrire directement vos règles tarifaires :
```
Prix Roland : 7000 F/m² pour bâche, 9500 F/m² pour vinyle
Pelliculage : +1500 F/m²
Remise volume : -10% à partir de 20m²
```

#### Option B : Upload PDF
Importer un document PDF contenant vos grilles tarifaires.

---

## 🎨 Routes API

### Devis

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/devis` | Liste des devis |
| POST | `/api/devis` | Créer un devis |
| GET | `/api/devis/:id` | Détail d'un devis |
| PUT | `/api/devis/:id` | Modifier un devis |
| DELETE | `/api/devis/:id` | Supprimer un devis |
| POST | `/api/devis/:id/convert` | Convertir en dossier |
| GET | `/api/devis/:id/pdf` | Télécharger PDF |

### Factures

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/factures` | Liste des factures |
| POST | `/api/factures/generate` | Générer une facture |
| GET | `/api/factures/:id/pdf` | Télécharger PDF |

### Tarifs

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/tarifs` | Liste des tarifs |
| PUT | `/api/tarifs/:id` | Modifier un tarif |
| POST | `/api/tarifs/optimize-ai` | Optimisation IA |

### OpenAI Config

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/settings/openai` | Config actuelle |
| PUT | `/api/settings/openai` | Mettre à jour |
| POST | `/api/settings/openai/test` | Tester connexion |
| POST | `/api/settings/openai/upload-pdf` | Upload PDF |

---

## 💡 Utilisation

### Créer un devis

1. Se connecter en tant que préparateur
2. Cliquer sur **Créer un devis** dans le menu
3. Choisir Roland ou Xerox
4. Remplir le formulaire
5. Le prix est estimé automatiquement
6. Sauvegarder le devis

### Convertir en dossier

1. Aller dans **Mes devis**
2. Cliquer sur un devis validé
3. Cliquer sur **Convertir en dossier**
4. Le devis devient un dossier d'impression

### Générer une facture

**Automatique** : Une facture est générée automatiquement quand le livreur marque un dossier comme "Terminé".

**Manuel** : L'admin peut forcer la génération via l'API.

---

## 🔧 Tarifs par défaut

Le système est pré-configuré avec des tarifs d'exemple :

### Roland
- Bâche standard : 7000 F/m²
- Vinyle adhésif : 9500 F/m²
- Pelliculage : 1500 F/m²
- Découpe forme : 2000 F forfait

### Xerox
- A4 80g N&B : 25 F/page
- A4 80g Couleur : 75 F/page
- Reliure spirale : 500 F/unité

### Remises
- -10% à partir de 20m² (Roland)
- -15% à partir de 500 pages (Xerox)

**Note** : Ces tarifs sont modifiables par l'administrateur.

---

## 🐛 Dépannage

### Erreur "Table doesn't exist"
→ Vous n'avez pas exécuté la migration SQL

### Erreur "Module not found: openai"
→ Exécutez `npm install openai` dans le dossier backend

### Les PDF ne se génèrent pas
→ Vérifiez que les dossiers `uploads/devis` et `uploads/factures` existent et sont accessibles en écriture

### L'IA ne fonctionne pas
→ Vérifiez la clé API OpenAI dans les paramètres admin

---

## 📚 Documentation complète

Pour plus de détails techniques, consultez :
- `GUIDE_IMPLEMENTATION_DEVIS_FACTURATION.md` - Guide technique complet
- `backend/services/openaiService.js` - Documentation du service IA
- `backend/database/migrations/002_devis_facturation.sql` - Structure de la base

---

## 🎉 Statut du projet

✅ **Backend** : Complet et fonctionnel
- Services (OpenAI, PDF)
- Routes API
- Migration SQL

✅ **Frontend** : Menu et routes de base
- Navigation intégrée
- Routes configurées
- Placeholders en place

⏳ **À venir** : Composants React complets
- Formulaires de création
- Listes et tableaux
- Détails et actions

---

## 📞 Support

Pour toute question ou problème :
1. Consultez la documentation
2. Vérifiez les logs serveur
3. Testez les routes API avec Postman

---

**Version** : 1.0.0  
**Date** : 2025-10-09  
**Auteur** : Agent Mode (Claude)
