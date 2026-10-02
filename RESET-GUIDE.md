# 🧹 Guide de Réinitialisation de la Plateforme

## 🎯 Objectif

Remettre la plateforme à zéro comme si elle venait d'être installée, tout en conservant les utilisateurs et la configuration.

## ⚡ Accès Rapide

### Via l'interface web (le plus simple)

1. Connectez-vous en tant qu'**Admin**
2. Allez dans **⚙️ Paramètres**
3. Cliquez sur **Réinitialisation** dans le menu latéral
4. Tapez `RESET` et confirmez

### Via le terminal

```bash
cd /var/www/imprimerie/backend/scripts
node reset-platform-cli.js
```

## 📋 Ce qui sera supprimé

- ❌ Tous les dossiers
- ❌ Tous les fichiers (PDF, images)
- ❌ Toutes les factures et devis
- ❌ Tous les paiements
- ❌ L'historique complet

## ✅ Ce qui sera conservé

- ✓ Les comptes utilisateurs
- ✓ Les formulaires Roland et Xerox
- ✓ Les paramètres (couleurs, clé OpenAI, etc.)

## 🔄 Après réinitialisation

Le prochain dossier créé aura le numéro **001**.

## ⚠️ Important

Cette action est **IRRÉVERSIBLE**. Assurez-vous d'avoir une sauvegarde si nécessaire.

## 📖 Documentation complète

Consultez `/var/www/imprimerie/backend/scripts/README-RESET.md` pour plus de détails.
