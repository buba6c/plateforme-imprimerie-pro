# 🧹 Réinitialisation de la Plateforme

Ce dossier contient les outils pour réinitialiser complètement la plateforme Imprimerie.

## 📁 Fichiers

- **`resetPlatform.js`** : Module principal de réinitialisation (utilisé par l'API et le CLI)
- **`reset-platform-cli.js`** : Script CLI interactif pour réinitialiser depuis le terminal

## 🎯 Que fait la réinitialisation ?

### ✅ Supprime :
- ✓ Tous les dossiers créés sur la plateforme
- ✓ Tous les fichiers (PDF, images, etc.)
- ✓ Toutes les factures et devis
- ✓ Tous les paiements et mouvements financiers
- ✓ Tout l'historique des statuts
- ✓ Toutes les notifications

### 🔄 Réinitialise :
- ✓ Les séquences PostgreSQL à 001
- ✓ Le prochain dossier créé aura le numéro 001

### 🔒 Conserve :
- ✓ Tous les comptes utilisateurs et leurs rôles
- ✓ Les formulaires (Roland, Xerox)
- ✓ Les paramètres du site (couleurs, design, clé OpenAI, etc.)
- ✓ La structure des dossiers (le dossier `uploads/` reste mais vide)

## 🚀 Utilisation

### 1️⃣ Via l'interface web (Recommandé)

1. Connectez-vous en tant qu'**Administrateur**
2. Allez dans **Paramètres** (⚙️)
3. Cliquez sur l'onglet **Réinitialisation** dans la barre latérale
4. Consultez les statistiques de ce qui sera supprimé
5. Tapez `RESET` pour confirmer
6. Cliquez sur **Confirmer la réinitialisation**

### 2️⃣ Via le terminal (CLI)

```bash
cd /var/www/imprimerie/backend/scripts
node reset-platform-cli.js
```

Ou directement :

```bash
./reset-platform-cli.js
```

Le script vous demandera de taper `RESET` pour confirmer.

### 3️⃣ Via l'API (pour intégrations)

```bash
curl -X POST https://evocomprint.site/api/system/reset \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <votre_token>" \
  -d '{"confirmation": "RESET"}'
```

**Note**: Seuls les administrateurs peuvent exécuter cette action.

## ⚠️ Avertissements

- ⚠️ **Cette opération est IRRÉVERSIBLE**
- ⚠️ **Toutes les données seront perdues définitivement**
- ⚠️ **Pensez à faire une sauvegarde avant si nécessaire**

## 🔐 Sécurité

- Seuls les utilisateurs avec le rôle `admin` peuvent exécuter la réinitialisation
- Une confirmation explicite (`RESET`) est requise
- L'opération utilise une transaction SQL (rollback en cas d'erreur)
- Tous les logs sont enregistrés pour audit

## 📊 Exemple de sortie

```
🧹 ========================================
   RÉINITIALISATION DE LA PLATEFORME
========================================

📊 État avant réinitialisation:

   Dossiers: 15
   Paiements: 23
   Factures: 8
   Devis: 5
   Historique: 147
   Notifications: 89

🗑️  Suppression des données...

✅ historique_statuts: 147 enregistrements supprimés
✅ notifications: 89 enregistrements supprimés
✅ paiements: 23 enregistrements supprimés
✅ factures: 8 enregistrements supprimés
✅ devis: 5 enregistrements supprimés
✅ dossiers: 15 enregistrements supprimés

🔄 Réinitialisation des séquences...

🔄 Séquence réinitialisée: dossiers_id_seq
🔄 Séquence réinitialisée: paiements_id_seq
🔄 Séquence réinitialisée: factures_id_seq
🔄 Séquence réinitialisée: devis_id_seq

✅ Transaction validée

🗂️  Suppression des fichiers...

📊 Fichiers trouvés: 45
🗑️  Fichier supprimé: /uploads/dossier-1/devis.pdf
🗑️  Fichier supprimé: /uploads/dossier-1/fichier.jpg
...
📊 Fichiers restants: 0

✅ Vérification finale:

   Dossiers: 0
   Paiements: 0
   Factures: 0
   Devis: 0
   Fichiers supprimés: 45

🎉 ========================================
   RÉINITIALISATION TERMINÉE AVEC SUCCÈS
========================================

📋 Résumé:
   ✅ 15 dossiers supprimés
   ✅ 23 paiements supprimés
   ✅ 8 factures supprimées
   ✅ 5 devis supprimés
   ✅ 45 fichiers supprimés
   ✅ Séquences réinitialisées à 001

💡 Le prochain dossier créé aura le numéro: 001

🔒 Éléments conservés:
   ✅ Comptes utilisateurs
   ✅ Formulaires (Roland, Xerox)
   ✅ Paramètres du site
   ✅ Structure des dossiers
```

## 🛠️ Maintenance

Pour tester le script sans exécuter la réinitialisation, vous pouvez consulter les statistiques :

```bash
curl https://evocomprint.site/api/system/reset/stats \
  -H "Authorization: Bearer <votre_token>"
```

Réponse :

```json
{
  "success": true,
  "stats": {
    "dossiers": 15,
    "paiements": 23,
    "factures": 8,
    "devis": 5,
    "historique": 147,
    "notifications": 89
  }
}
```

## 🐛 Dépannage

### Erreur : "Cannot find module '../config/database'"

Assurez-vous que le fichier `/var/www/imprimerie/backend/config/database.js` existe et que les chemins d'import sont corrects.

### Erreur : "Accès refusé"

Vérifiez que vous êtes connecté avec un compte administrateur.

### Erreur : "column 'xxx' does not exist"

La structure de la base de données a peut-être changé. Vérifiez les noms de colonnes et mettez à jour le script si nécessaire.

## 📝 Notes

- Le script utilise des transactions SQL pour garantir l'intégrité des données
- En cas d'erreur, toutes les modifications sont annulées (rollback)
- Les fichiers sont supprimés récursivement dans le dossier `uploads/`
- Le dossier `uploads/` lui-même est conservé pour éviter les erreurs d'upload

## 🔗 Endpoints API

### POST `/api/system/reset`
Réinitialise la plateforme

**Body:**
```json
{
  "confirmation": "RESET"
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Plateforme réinitialisée avec succès",
  "data": {
    "success": true,
    "deleted": {
      "dossiers": 15,
      "paiements": 23,
      "factures": 8,
      "devis": 5
    },
    "filesDeleted": 45
  }
}
```

### GET `/api/system/reset/stats`
Récupère les statistiques avant réinitialisation

**Réponse:**
```json
{
  "success": true,
  "stats": {
    "dossiers": 15,
    "paiements": 23,
    "factures": 8,
    "devis": 5,
    "historique": 147,
    "notifications": 89
  }
}
```
