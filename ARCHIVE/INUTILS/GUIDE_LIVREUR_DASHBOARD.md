# 🚚 Guide Utilisateur Dashboard Livreur - Plateforme Imprimerie

## 📋 Table des Matières
- [Accès et Connexion](#accès-et-connexion)
- [Vue d'Ensemble du Dashboard](#vue-densemble-du-dashboard)
- [Sections Spécialisées](#sections-spécialisées)
- [Gestion des Livraisons](#gestion-des-livraisons)
- [Fonctionnalités Avancées](#fonctionnalités-avancées)
- [Optimisation des Tournées](#optimisation-des-tournées)
- [Guide Pas-à-Pas](#guide-pas-à-pas)
- [FAQ et Dépannage](#faq-et-dépannage)

---

## 🔐 Accès et Connexion

### Informations de Connexion
- **URL**: http://localhost:3001
- **Email**: `livreur@evocomprint.com`
- **Mot de passe**: `livreur123`
- **Rôle**: Livreur

### Première Connexion
1. Ouvrir l'URL dans votre navigateur
2. Saisir vos identifiants
3. Cliquer sur "Se connecter"
4. Vous serez automatiquement dirigé vers le dashboard livreur

---

## 🏠 Vue d'Ensemble du Dashboard

### Interface Principale
Le dashboard livreur présente une interface moderne et intuitive avec :

#### 🎯 Métriques Clés (Widget en Haut)
- **📦 Total Livraisons** : Nombre total de dossiers à livrer
- **⏰ Temps Estimé** : Durée totale estimée des livraisons (heures)
- **🛣️ Distance** : Kilométrage total estimé pour les tournées
- **📈 Taux Réussite** : Pourcentage de livraisons réussies

#### 🎨 Thème Visuel
- **Couleur principale** : Orange (#F97316) pour l'identité livreur
- **Design** : Interface moderne avec animations fluides
- **Responsive** : Adapté aux appareils mobiles et tablettes

---

## 🧭 Sections Spécialisées

### Navigation Latérale Améliorée
La barre de navigation contient 5 sections spécialisées :

#### 🏠 Dashboard
- Vue d'ensemble générale
- Métriques en temps réel
- Accès rapide aux actions principales

#### 📅 Planning
- **Objectif** : Organisation et planification des livraisons
- **Contenu** :
  - Calendrier des livraisons
  - Créneaux horaires optimisés
  - Assignation des dossiers par jour
  - Priorisation automatique

#### 🗺️ Tournées
- **Objectif** : Optimisation des parcours de livraison
- **Contenu** :
  - Calcul d'itinéraires optimisés
  - Regroupement par zones géographiques
  - Estimation des temps de trajet
  - Mode GPS intégré

#### 📋 Historique
- **Objectif** : Suivi des performances passées
- **Contenu** :
  - Historique complet des livraisons
  - Filtrage par dates et statuts
  - Analyse des tendances
  - Rapport de performance

#### 📊 Performances
- **Objectif** : Métriques détaillées et KPI
- **Contenu** :
  - Statistiques avancées
  - Taux de réussite par zone
  - Temps moyens de livraison
  - Objectifs et accomplissements

---

## 📦 Gestion des Livraisons

### Compartiments Intelligents
Les dossiers sont organisés en 4 compartiments distincts :

#### 1️⃣ À Livrer (Badge Bleu)
- **Statuts** : `pret_livraison`, `attente_livraison`
- **Actions** :
  - Voir les détails du dossier
  - Démarrer la livraison
  - Modifier la priorité
  - Planifier un créneau

#### 2️⃣ En Livraison (Badge Orange)
- **Statuts** : `en_livraison`, `en_cours_livraison`
- **Actions** :
  - Marquer comme livré
  - Signaler un problème
  - Géolocaliser l'adresse
  - Contacter le client

#### 3️⃣ Livrés (Badge Vert)
- **Statuts** : `livre`, `delivered`, `termine`
- **Actions** :
  - Consulter les détails
  - Générer un rapport
  - Noter la satisfaction client

#### 4️⃣ Retours/Échecs (Badge Rouge)
- **Statuts** : `retour`, `echec_livraison`, `reporte`
- **Actions** :
  - Programmer une nouvelle tentative
  - Analyser la cause d'échec
  - Contacter le client

### Filtres et Recherche
- **Filtres par statut** : Sélection rapide par catégorie
- **Filtres par zone** : Paris, Banlieue, Île-de-France
- **Recherche** : Par numéro de commande, nom client, adresse
- **Tri** : Par priorité, date, zone géographique

---

## ⚡ Fonctionnalités Avancées

### 🌍 Géolocalisation GPS
- **Localisation automatique** : Détection de votre position
- **Navigation** : Intégration avec Google Maps/Apple Maps
- **Optimisation** : Calcul du meilleur itinéraire
- **Suivi temps réel** : Mise à jour de la position

### 📱 Interface Mobile Optimisée
- **Design responsive** : Adapté aux smartphones
- **Actions rapides** : Boutons grands et accessibles
- **Mode paysage** : Optimisé pour la navigation GPS
- **Notifications push** : Alertes en temps réel

### 🎯 Calcul Automatique de Priorités
Les priorités sont calculées selon :
- **Urgence client** : Délais de livraison
- **Distance** : Proximité géographique
- **Créneaux** : Disponibilité du destinataire
- **Type de produit** : Fragilité, poids, dimensions

### ⚡ Actions Rapides
- **Démarrer/Arrêter tournée** : Bouton global
- **Livraison express** : Actions en un clic
- **Signalement problème** : Interface simplifiée
- **Contact client** : Appel direct depuis l'app

---

## 🗺️ Optimisation des Tournées

### Zones de Livraison Intelligentes
Le système identifie automatiquement :

#### 🏙️ Zone Paris (75)
- **Caractéristiques** : Centre-ville, accès limité
- **Optimisation** : Livraisons groupées par arrondissement
- **Temps estimé** : 30 minutes par livraison

#### 🏘️ Zone Banlieue (92, 93, 94)
- **Caractéristiques** : Proche banlieue accessible
- **Optimisation** : Circuits par commune
- **Temps estimé** : 25 minutes par livraison

#### 🌳 Zone Île-de-France (77, 78, 91, 95)
- **Caractéristiques** : Grande couronne
- **Optimisation** : Regroupement par secteur
- **Temps estimé** : 45 minutes par livraison

### Calculs Automatiques
- **Distance totale** : Kilométrage optimisé
- **Temps de trajet** : Estimations basées sur le trafic
- **Coût carburant** : Calcul automatique
- **Efficacité** : Ratio livraisons/heure

---

## 🚀 Guide Pas-à-Pas

### Démarrage de Journée
1. **Connexion** au dashboard
2. **Consultation** des métriques du jour
3. **Vérification** des dossiers "À Livrer"
4. **Activation GPS** pour la géolocalisation
5. **Planification** de la première tournée

### Processus de Livraison
1. **Sélection** d'un dossier "À Livrer"
2. **Clic** sur "Démarrer Livraison"
3. **Navigation** vers l'adresse (GPS)
4. **Livraison** sur site
5. **Marquage** comme "Livré" ou "Retour"

### Gestion des Incidents
1. **Signalement** immédiat via l'interface
2. **Sélection** du type d'incident
3. **Commentaire** détaillé
4. **Planification** d'une nouvelle tentative
5. **Notification** automatique du client

### Fin de Journée
1. **Vérification** que tous les dossiers sont traités
2. **Consultation** des métriques de performance
3. **Génération** du rapport journalier
4. **Synchronisation** des données

---

## 📊 Métriques et KPI

### Indicateurs Principaux
- **Livraisons/jour** : Nombre moyen de livraisons
- **Taux de réussite** : Pourcentage de livraisons réussies du premier coup
- **Temps moyen** : Durée moyenne par livraison
- **Distance/livraison** : Kilomètrage moyen par dossier

### Objectifs de Performance
- **Taux de réussite** : ≥ 90%
- **Ponctualité** : ≥ 95% des livraisons dans les créneaux
- **Efficacité** : ≥ 6 livraisons par heure
- **Satisfaction client** : ≥ 4.5/5 en moyenne

---

## ❓ FAQ et Dépannage

### Questions Fréquentes

**Q: Comment modifier la priorité d'une livraison ?**
R: Cliquez sur le badge de priorité dans la carte du dossier et sélectionnez le nouveau niveau.

**Q: Que faire si le GPS ne fonctionne pas ?**
R: Vérifiez que vous avez autorisé la géolocalisation dans votre navigateur. Actualisez la page si nécessaire.

**Q: Comment signaler un problème de livraison ?**
R: Utilisez le bouton "Signaler un problème" dans la carte du dossier, puis décrivez la situation.

**Q: Peut-on modifier l'ordre des livraisons ?**
R: Oui, utilisez la section "Tournées" pour réorganiser et optimiser votre parcours.

### Problèmes Courants

**Problème** : Les dossiers n'apparaissent pas
**Solution** : Vérifiez votre connexion internet et actualisez la page

**Problème** : Les métriques semblent incorrectes
**Solution** : Les calculs se mettent à jour automatiquement, attendez quelques secondes

**Problème** : Interface lente sur mobile
**Solution** : Fermez les applications en arrière-plan et utilisez une connexion WiFi si possible

### Support Technique
- **Email** : support@evocomprint.com
- **Téléphone** : 01 23 45 67 89
- **Horaires** : 8h-18h du lundi au vendredi

---

## 🎯 Conseils d'Utilisation

### Bonnes Pratiques
1. **Démarrez** toujours votre journée par la consultation du planning
2. **Activez** la géolocalisation dès le début
3. **Groupez** les livraisons par zone géographique
4. **Mettez à jour** le statut en temps réel
5. **Consultez** régulièrement les performances

### Optimisation des Performances
- **Planifiez** vos tournées la veille
- **Utilisez** les filtres pour gagner du temps
- **Exploitez** les fonctionnalités GPS
- **Communiquez** proactivement avec les clients
- **Analysez** vos métriques pour vous améliorer

---

*Guide mis à jour pour la version Dashboard Livreur Avancé - 2024*
*Pour toute question, n'hésitez pas à contacter l'équipe support* 🚚