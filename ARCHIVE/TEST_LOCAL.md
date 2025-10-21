# Test Local de EvocomPrint

## 🚀 Application en cours d'exécution

L'application frontend est maintenant accessible sur : **http://localhost:3000**

## 🔐 Comptes de test disponibles

L'application utilise des services mockés avec les comptes suivants :

### Admin
- **Email :** `admin@evocomprint.com`
- **Mot de passe :** `admin123` ou `password`
- **Rôle :** Administrateur (accès complet)

### Préparateur  
- **Email :** `preparateur@evocomprint.com`
- **Mot de passe :** `prep123` ou `password`
- **Rôle :** Préparateur (nouveau dossiers, préparation)

### Imprimeur Roland
- **Email :** `roland@evocomprint.com`
- **Mot de passe :** `password`
- **Rôle :** Imprimeur Roland (dossiers Roland prêts/en cours)

### Imprimeur Xerox
- **Email :** `xerox@evocomprint.com`
- **Mot de passe :** `password`
- **Rôle :** Imprimeur Xerox (dossiers Xerox prêts/en cours)

### Livreur
- **Email :** `livreur@evocomprint.com`
- **Mot de passe :** `password`
- **Rôle :** Livreur (dossiers prêts livraison/en cours)

## 🎯 Fonctionnalités disponibles

### ✅ Implémentées et testables
- **Authentification** : Connexion/déconnexion avec gestion des rôles
- **Dashboard Admin** : Vue d'ensemble avec statistiques
- **Gestion Utilisateurs** : CRUD complet des utilisateurs
- **Gestion Rôles & Permissions** : Interface de configuration
- **Gestion Dossiers** : 
  - Listing avec filtres (statut, type, recherche)
  - Création de nouveaux dossiers
  - Visualisation détaillée avec historique
  - Changement de statut selon workflow et rôles
  - Pagination
- **Workflow complet** : Transitions de statut selon les rôles
- **Interface responsive** : Compatible mobile/desktop

### 🚧 En cours / À implémenter
- **Gestion fichiers** : Upload/téléchargement
- **Notifications temps réel** : WebSocket
- **Rapports & Statistiques** : Graphiques avancés
- **API Backend complète** : Base de données PostgreSQL

## 🔄 Workflow des dossiers

Le système suit un workflow strict selon les rôles :

1. **Nouveau** → **En préparation** (Préparateur)
2. **En préparation** → **Prêt impression** (Préparateur)  
3. **Prêt impression** → **En impression** (Imprimeur)
4. **En impression** → **Imprimé** (Imprimeur)
5. **Imprimé** → **Prêt livraison** (Imprimeur)
6. **Prêt livraison** → **En livraison** (Livreur)
7. **En livraison** → **Livré** (Livreur)
8. **Livré** → **Terminé** (Admin)

## 🎨 Interface utilisateur

- **Design moderne** : Tailwind CSS avec palette cohérente
- **Navigation intuitive** : Sidebar responsive avec icônes
- **Composants réutilisables** : Cards, modales, formulaires
- **Feedback utilisateur** : Messages de succès/erreur
- **Indicateurs visuels** : Badges de statut colorés, priorités

## 📊 Données de test

L'application contient des données mockées :
- **5 utilisateurs** avec différents rôles
- **6 dossiers** avec statuts variés
- **Historique des changements** de statut
- **Fichiers simulés** (sans upload réel)

## 🛠️ Commandes utiles

```bash
# Démarrer le frontend
cd frontend && npm start

# Démarrer avec Docker (quand disponible)
./init-local.sh start

# Arrêter
./init-local.sh stop

# Voir les logs
./init-local.sh logs
```

## 🐛 Debug et développement

- **Console développeur** : Messages de debug dans la console
- **Mode mock activé** : Voir les logs pour confirmation
- **Services adaptatifs** : Bascule automatique real API → mock
- **Hot reload** : Modifications en temps réel

## 🚀 Prochaines étapes

1. **Installer Docker** pour tester avec le backend complet
2. **Tests utilisateurs** : Navigation et workflow
3. **Ajout fonctionnalités** : Fichiers, notifications
4. **Déploiement VPS** : Configuration production

---

## 💡 Conseils d'utilisation

1. **Commencez avec Admin** pour voir toutes les fonctionnalités
2. **Testez les rôles** en changeant de compte
3. **Créez des dossiers** pour tester le workflow
4. **Utilisez les filtres** pour navigation efficace
5. **Visualisez l'historique** dans les détails des dossiers