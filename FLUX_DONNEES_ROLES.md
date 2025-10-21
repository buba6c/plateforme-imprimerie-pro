# 📊 Flux des Données selon les Rôles

## Architecture Générale

### Backend : Filtrage au niveau API
Le backend (`/backend/routes/dossiers.js`) filtre automatiquement les dossiers selon le rôle de l'utilisateur connecté :

```javascript
// Ligne 42-100 : Fonction checkDossierPermission
if (user.role === 'preparateur') {
  // Accès uniquement aux dossiers créés par lui
  // Tous les statuts : nouveau, en_cours, a_revoir, pret_impression
}

if (user.role === 'imprimeur_roland' || user.role === 'imprimeur_xerox') {
  // Accès selon la machine ET le statut
  // Machine : Roland OU Xerox (selon le rôle)
  // Statuts : pret_impression, en_impression, imprime
}

if (user.role === 'livreur') {
  // Accès aux dossiers prêts pour livraison
  // Statuts : imprime, pret_livraison, en_livraison, livre
}
```

### Frontend : Dashboards Spécialisés

## 🎨 Dashboard Préparateur
**Fichier** : `frontend/src/components/PreparateurDashboardUltraModern.js`

### Données Affichées
- **Champ statut** : `d.statut` ou `d.statut_dossier`
- **Statuts filtrés** : 
  - `nouveau` - Nouveaux dossiers non traités
  - `en_cours` - Dossiers en cours de préparation
  - `a_revoir` - Dossiers à corriger

### Sections
1. **"En Préparation"** : `nouveau`, `en_cours`
2. **"En Cours"** : Dossiers validés

### Actions
- ✅ Valider → passe à `pret_impression`
- ⚠️ Mettre à revoir → passe à `a_revoir`
- 🗑️ Supprimer (si non validé)

---

## 🖨️ Dashboard Imprimeur (Roland/Xerox)
**Fichier** : `frontend/src/components/ImprimeurDashboardUltraModern.js`

### Données Affichées
- **Champ statut** : `d.statut` ou `d.statut_dossier`
- **Champ machine** : `d.machine_impression` ou `d.type_formulaire`
- **Statuts filtrés** :
  - `pret_impression` - Prêt à imprimer
  - `en_impression` - En cours d'impression
  - `imprime` - Impression terminée

### Filtres Spécifiques
- **Machine** : 
  - Imprimeur Roland → voir uniquement `machine_impression === 'roland'`
  - Imprimeur Xerox → voir uniquement `machine_impression === 'xerox'`

### Sections
1. **"📋 Prêt à Imprimer"** : `pret_impression`
   - Badge machine (Roland = rose, Xerox = émeraude)
   - Bouton "Démarrer"
2. **"⚡ En Impression"** : `en_impression`
   - Badge machine
   - Bouton "Terminé"

### Actions
- 🖨️ Démarrer impression → passe à `en_impression`
- ✅ Marquer imprimé → passe à `imprime`

### Statistiques
```javascript
stats = {
  total: total dossiers pour cette machine,
  fileAttente: dossiers avec statut 'pret_impression',
  enImpression: dossiers avec statut 'en_impression',
  termines: dossiers avec statut 'imprime'
}
```

---

## 🚚 Dashboard Livreur
**Fichier** : `frontend/src/components/LivreurDashboardUltraModern.js`

### Données Affichées
- **Champ statut** : `d.statut` ou `d.statut_dossier`
- **Champs additionnels** :
  - `d.adresse_livraison` - Adresse de livraison
  - `d.telephone_contact` - Téléphone client
  - `d.mode_paiement` - Mode de paiement
  - `d.montant_a_encaisser` - Montant à encaisser
- **Statuts filtrés** :
  - `imprime` - Imprimé, prêt à livrer
  - `pret_livraison` - Prêt pour livraison
  - `en_livraison` - En cours de livraison
  - `livre` - Livré

### Sections
1. **"📦 À Livrer"** : `imprime` + `pret_livraison`
   - Warnings si adresse ou téléphone manquant
   - Bouton "Démarrer" (désactivé si pas d'adresse)
2. **"🚚 En Livraison"** : `en_livraison`
   - Affichage adresse et contact
   - Bouton "Livré"
3. **"✅ Livrés"** : `livre`
   - Historique des livraisons
   - Pas d'action

### Actions
- 🚚 Démarrer livraison → passe à `en_livraison` (nécessite adresse)
- ✅ Marquer livré → passe à `livre`

### Validation
```javascript
if (!dossier.adresse_livraison) {
  // Afficher warning ⚠️ Adresse à compléter
  // Désactiver bouton "Démarrer"
}
```

### Statistiques
```javascript
stats = {
  total: total dossiers livreur,
  aLivrer: dossiers 'imprime' + 'pret_livraison',
  enLivraison: dossiers 'en_livraison',
  livres: dossiers 'livre'
}
```

---

## 🔄 Flux de Données Complet

### Cycle de Vie d'un Dossier

```
1. PRÉPARATEUR crée dossier
   └─> statut: nouveau
   
2. PRÉPARATEUR travaille sur le dossier
   └─> statut: en_cours
   
3. PRÉPARATEUR valide le dossier
   └─> statut: pret_impression
   
4. IMPRIMEUR (Roland/Xerox) démarre l'impression
   └─> statut: en_impression
   
5. IMPRIMEUR termine l'impression
   └─> statut: imprime
   
6. LIVREUR démarre la livraison
   └─> statut: en_livraison
   
7. LIVREUR marque comme livré
   └─> statut: livre
```

### Retours en Arrière

```
Si problème détecté:

IMPRIMEUR peut renvoyer en révision:
  en_impression → a_revoir
  
PRÉPARATEUR corrige:
  a_revoir → en_cours → pret_impression
```

---

## 🔧 Normalisation des Statuts

### Fonction `normalizeStatus()`

Chaque dashboard a sa propre fonction pour normaliser les noms de statuts variables :

```javascript
// Dashboard Préparateur
normalizeStatus('En cours') → 'en_cours'
normalizeStatus('À revoir') → 'a_revoir'
normalizeStatus('Prêt impression') → 'pret_impression'

// Dashboard Imprimeur
normalizeStatus('Prêt pour impression') → 'pret_impression'
normalizeStatus('En impression') → 'en_impression'
normalizeStatus('Terminé') → 'imprime'  // Important !
normalizeStatus('Imprimé') → 'imprime'

// Dashboard Livreur
normalizeStatus('Imprimé') → 'imprime'
normalizeStatus('Prêt livraison') → 'pret_livraison'
normalizeStatus('En livraison') → 'en_livraison'
normalizeStatus('Livré') → 'livre'
```

---

## 📡 API Endpoints

### GET /api/dossiers
**Filtrage automatique côté backend selon le rôle**

```javascript
// Réponse pour Préparateur
{
  success: true,
  dossiers: [
    {
      id: 1,
      statut: "en_cours",  // ← champ normalisé
      client: "ABC Corp",
      created_by: 5, // ID du préparateur
      // ... autres champs
    }
  ]
}

// Réponse pour Imprimeur Roland
{
  success: true,
  dossiers: [
    {
      id: 2,
      statut: "pret_impression",
      machine_impression: "roland",  // ← filtré côté backend
      // ... autres champs
    }
  ]
}

// Réponse pour Livreur
{
  success: true,
  dossiers: [
    {
      id: 3,
      statut: "imprime",
      adresse_livraison: "123 Rue Example",
      telephone_contact: "+221 77 123 4567",
      mode_paiement: "Espèces",
      montant_a_encaisser: 25000,
      // ... autres champs
    }
  ]
}
```

### PUT /api/dossiers/:id/statut
**Changement de statut**

```javascript
// Request
{
  nouveau_statut: "en_impression"
}

// Response
{
  success: true,
  dossier: { /* dossier mis à jour */ }
}
```

---

## 🎯 Points Clés d'Intégration

### 1. Champ Statut
- **Base de données** : `dossiers.statut` (VARCHAR)
- **Frontend** : Utilise `d.statut` ou `d.statut_dossier` (fallback)
- **Normalisation** : Toujours normaliser avant comparaison

### 2. Filtrage Machine (Imprimeurs)
```javascript
// Backend filtre automatiquement
WHERE machine LIKE 'roland%' // Pour imprimeur_roland
WHERE machine LIKE 'xerox%'  // Pour imprimeur_xerox

// Frontend re-filtre (optionnel) dans le dashboard
if (selectedMachine !== 'all') {
  filtered = filtered.filter(d => 
    d.machine_impression?.toLowerCase() === selectedMachine
  );
}
```

### 3. Validation Adresse (Livreur)
```javascript
// Dashboard affiche warning
const hasAddress = dossier.adresse_livraison && 
                  dossier.adresse_livraison.trim() !== '';

// Bouton désactivé si pas d'adresse
disabled={!dossier.adresse_livraison}
```

---

## ✅ Corrections Appliquées (17 Oct 2025)

### ImprimeurDashboardUltraModern.js
- ✅ Changé `d.statut_dossier` → `d.statut || d.statut_dossier`
- ✅ Changé filtre `'termine'` → `'imprime'`
- ✅ Action "Terminé" → envoie `'imprime'` au lieu de `'termine'`

### LivreurDashboardUltraModern.js  
- ✅ Changé `d.statut_dossier` → `d.statut || d.statut_dossier`
- ✅ Amélioration normalizeStatus avec `.replace(/\s+/g, '_')`

### Résultat
Chaque rôle voit maintenant exactement les dossiers qui le concernent, avec les bons statuts ! 🎉
