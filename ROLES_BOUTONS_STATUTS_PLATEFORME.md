# 👥 RÔLES, BOUTONS ET STATUTS - PLATEFORME IMPRIMERIE

**Date**: 17 octobre 2025  
**Version**: 1.0  
**Status**: Documentation complète par rôle

---

## 📋 TABLE DES MATIÈRES

1. [Préparateur](#-1-préparateur)
2. [Imprimeur Roland](#-2-imprimeur-roland)
3. [Imprimeur Xerox](#-3-imprimeur-xerox)
4. [Livreur](#-4-livreur)
5. [Administrateur](#-5-administrateur)
6. [Tableau Récapitulatif](#-tableau-récapitulatif-complet)

---

## 📝 1. PRÉPARATEUR

### 🎯 **Permissions**
- ✅ Créer des nouveaux dossiers
- ✅ Voir uniquement ses propres dossiers
- ✅ Modifier ses dossiers en cours de préparation
- ✅ Supprimer ses dossiers en statut "En cours"
- ✅ Uploader des fichiers sur ses dossiers
- ❌ Voir les dossiers des autres préparateurs
- ❌ Accéder aux dossiers en impression ou livraison

### 📊 **Statuts Visibles**

| Statut | Code | Couleur | Description |
|--------|------|---------|-------------|
| **Nouveau** | `nouveau` | 🔵 Bleu | Dossier vient d'être créé |
| **En cours** | `en_cours` | 🟡 Jaune | En cours de préparation |
| **À revoir** | `a_revoir` | 🔴 Rouge | Nécessite une correction |
| **Prêt impression** | `pret_impression` | 🟣 Violet | Validé, prêt pour imprimeur |

### 🎛️ **Boutons Disponibles par Statut**

#### **Statut: Nouveau** 🔵
```
┌────────────────────────────────────────┐
│  📋 Marquer prêt pour impression       │
└────────────────────────────────────────┘
```
- **Action**: Passe le dossier en `pret_impression`
- **Condition**: Tous les fichiers requis uploadés
- **Effet**: Dossier visible par les imprimeurs

---

#### **Statut: En cours** 🟡
```
┌────────────────────────────────────────┐
│  📋 Marquer prêt pour impression       │
└────────────────────────────────────────┘
```
- **Action**: Passe le dossier en `pret_impression`
- **Condition**: Tous les fichiers requis uploadés
- **Effet**: Dossier envoyé aux imprimeurs
- **Note**: Peut aussi supprimer le dossier à ce stade

---

#### **Statut: À revoir** 🔴
```
┌────────────────────────────────────────┐
│  📋 Marquer prêt pour impression       │
└────────────────────────────────────────┘
```
- **Action**: Revalide le dossier après corrections
- **Condition**: Corrections effectuées
- **Effet**: Renvoie en `pret_impression`
- **Workflow**: Retour d'un imprimeur/admin qui a demandé révision

---

#### **⚠️ Boutons Affichés Mais Non Fonctionnels**

Ces boutons apparaissent dans le frontend mais génèrent une **erreur 403** car non autorisés backend :

**Statut: En impression** (vu par erreur)
```
┌────────────────────────────────────────┐
│  🔄 Renvoyer à revoir                  │  ❌ 403 ERROR
└────────────────────────────────────────┘
```

**Statut: Prêt livraison** (vu par erreur)
```
┌────────────────────────────────────────┐
│  🔄 Renvoyer à revoir                  │  ❌ 403 ERROR
└────────────────────────────────────────┘
```

**Recommandation**: Ces boutons doivent être retirés du frontend.

---

### 📱 **Interface Préparateur**

#### Dashboard
- Affiche uniquement ses dossiers créés
- Filtres: Tous / En cours / Prêt / À revoir
- Bouton "➕ Nouveau dossier" toujours visible
- Compteurs: Total, En cours, Validés

#### Carte Dossier
```
┌──────────────────────────────────────────────────┐
│ [Barre colorée selon statut]                     │
│                                                   │
│  CMD-2025-001          [Badge Statut]            │
│  👤 Jean Dupont                                   │
│  📋 Roland                                        │
│  🕐 15/10/2025 14:30                             │
│                                                   │
│  [👁️ Voir Détails]  [🗑️ Supprimer]             │
└──────────────────────────────────────────────────┘
```

---

## 🖨️ 2. IMPRIMEUR ROLAND

### 🎯 **Permissions**
- ✅ Voir tous les dossiers **machine Roland**
- ✅ Voir dossiers en statuts: `pret_impression`, `en_impression`, `imprime`, `pret_livraison`
- ✅ Changer statut des dossiers Roland
- ✅ Télécharger fichiers des dossiers
- ✅ Demander révision au préparateur
- ❌ Voir dossiers machine Xerox
- ❌ Voir dossiers en préparation
- ❌ Modifier/Supprimer dossiers

### 📊 **Statuts Visibles**

| Statut | Code | Couleur | Description |
|--------|------|---------|-------------|
| **Prêt impression** | `pret_impression` | 🟣 Violet | Validé par préparateur |
| **En impression** | `en_impression` | 🟦 Indigo | Impression en cours |
| **Imprimé** | `imprime` | 🔷 Cyan | Impression terminée |
| **Prêt livraison** | `pret_livraison` | 🟣 Violet | Prêt pour le livreur |

### 🎛️ **Boutons Disponibles par Statut**

#### **Statut: Prêt impression** 🟣
```
┌────────────────────────────────────────┐
│  🖨️ Démarrer impression                │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  🔄 Renvoyer à revoir                  │
└────────────────────────────────────────┘
```

**Démarrer impression**
- **Action**: Passe en `en_impression`
- **Effet**: Machine occupe le dossier
- **Notification**: Envoyée au préparateur + admin

**Renvoyer à revoir** ⚠️
- **Action**: Passe en `a_revoir`
- **Condition**: Requiert un commentaire
- **Effet**: Retour au préparateur
- **⚠️ PROBLÈME**: Transition non autorisée backend → **403 ERROR**
- **Recommandation**: Ajouter cette transition au backend

---

#### **Statut: En impression** 🟦
```
┌────────────────────────────────────────┐
│  ✅ Marquer comme imprimé              │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  🔄 Renvoyer à revoir                  │
└────────────────────────────────────────┘
```

**Marquer comme imprimé**
- **Action**: Passe en `imprime`
- **Effet**: Impression terminée
- **⚠️ NOTE**: Le frontend ajoute une étape intermédiaire `imprime` que le backend ne connaît pas

**Renvoyer à revoir** ⚠️
- **Action**: Annule impression, retour `a_revoir`
- **⚠️ PROBLÈME**: Transition non autorisée backend → **403 ERROR**

---

#### **Statut: Imprimé** 🔷
```
┌────────────────────────────────────────┐
│  📦 Marquer prêt livraison             │
└────────────────────────────────────────┘
```

**Marquer prêt livraison**
- **Action**: Passe en `pret_livraison`
- **Effet**: Visible par le livreur
- **Notification**: Envoyée au livreur + admin
- **⚠️ NOTE**: Statut `imprime` existe uniquement dans le frontend

---

#### **Statut: Prêt livraison** 🟣
```
┌────────────────────────────────────────┐
│  🔄 Renvoyer à revoir                  │
└────────────────────────────────────────┘
```

**Renvoyer à revoir** ⚠️
- **Cas d'usage**: Problème détecté avant livraison
- **⚠️ PROBLÈME**: Transition non définie backend → **403 ERROR**

---

### 📱 **Interface Imprimeur Roland**

#### Dashboard
- Onglet "En attente" (pret_impression)
- Onglet "En cours" (en_impression)
- Onglet "Terminés" (imprime, pret_livraison)
- **Filtre automatique**: Uniquement machine Roland
- Compteurs par statut

#### Carte Dossier
```
┌──────────────────────────────────────────────────┐
│ [Barre colorée selon statut]                     │
│                                                   │
│  CMD-2025-001          [Badge Statut]            │
│  👤 Jean Dupont (Préparateur)                    │
│  🖨️ Roland              📋 Machine Roland        │
│  🕐 15/10/2025 14:30                             │
│  📄 5 fichiers                                    │
│                                                   │
│  [👁️ Voir Détails]                              │
└──────────────────────────────────────────────────┘
```

---

## 🖨️ 3. IMPRIMEUR XEROX

### 🎯 **Permissions**
- ✅ Voir tous les dossiers **machine Xerox**
- ✅ Voir dossiers en statuts: `pret_impression`, `en_impression`, `imprime`, `pret_livraison`
- ✅ Changer statut des dossiers Xerox
- ✅ Télécharger fichiers des dossiers
- ✅ Demander révision au préparateur
- ❌ Voir dossiers machine Roland
- ❌ Voir dossiers en préparation
- ❌ Modifier/Supprimer dossiers

### 📊 **Statuts Visibles**

**Identiques à Imprimeur Roland** (voir section 2)

### 🎛️ **Boutons Disponibles par Statut**

**⚠️ EXACTEMENT LES MÊMES** que Imprimeur Roland (voir section 2)

Les deux rôles imprimeur ont :
- Mêmes transitions
- Mêmes boutons
- Mêmes limitations
- **Seule différence**: Filtre automatique sur le type de machine

---

### 📱 **Interface Imprimeur Xerox**

**Identique à Imprimeur Roland** avec filtre machine Xerox activé automatiquement.

---

## 🚚 4. LIVREUR

### 🎯 **Permissions**
- ✅ Voir tous les dossiers **prêts pour livraison**
- ✅ Voir dossiers en statuts: `pret_livraison`, `en_livraison`, `livre`, `termine`
- ✅ Changer statut des dossiers en livraison
- ✅ Télécharger documents de livraison
- ✅ Voir adresse de livraison
- ❌ Voir dossiers en préparation ou impression
- ❌ Modifier/Supprimer dossiers
- ❌ Accéder aux fichiers sources

### 📊 **Statuts Visibles**

| Statut | Code | Couleur | Description |
|--------|------|---------|-------------|
| **Prêt livraison** | `pret_livraison` | 🟣 Violet | Prêt à être livré |
| **En livraison** | `en_livraison` | 🟣 Violet | Livraison en cours |
| **Livré** | `livre` | 🟢 Vert | Client a reçu |
| **Terminé** | `termine` | ⚪ Gris | Dossier archivé |

### 🎛️ **Boutons Disponibles par Statut**

#### **Statut: Prêt livraison** 🟣
```
┌────────────────────────────────────────┐
│  🚚 Démarrer livraison                 │
└────────────────────────────────────────┘
```

**Démarrer livraison**
- **Action**: Passe en `en_livraison`
- **Effet**: Démarre le suivi de livraison
- **Info**: Peut programmer date/heure
- **Notification**: Envoyée au préparateur + admin

**⚠️ Bouton Manquant**: Livraison directe
```
┌────────────────────────────────────────┐
│  📦 Livrer directement                 │  ❌ NON IMPLÉMENTÉ
└────────────────────────────────────────┘
```
- **Action**: Passe directement en `livre` (skip `en_livraison`)
- **Backend**: Transition autorisée `pret_livraison` → `livre`
- **Frontend**: Bouton manquant
- **Recommandation**: Ajouter ce bouton pour livraisons immédiates

---

#### **Statut: En livraison** 🟣
```
┌────────────────────────────────────────┐
│  ✅ Marquer comme livré                │
└────────────────────────────────────────┘
```

**Marquer comme livré**
- **Action**: Passe en `livre`
- **Condition**: Peut demander signature client
- **Effet**: Livraison confirmée
- **Notification**: Envoyée à tous les acteurs

---

#### **Statut: Livré** 🟢
```
┌────────────────────────────────────────┐
│  🏁 Marquer comme terminé              │
└────────────────────────────────────────┘
```

**Marquer comme terminé**
- **Action**: Passe en `termine`
- **Effet**: Archive le dossier
- **Info**: Finalise le workflow complet
- **Note**: Peut être automatique après X jours

---

### 📱 **Interface Livreur**

#### Dashboard
- Onglet "À livrer" (pret_livraison)
- Onglet "En cours" (en_livraison)
- Onglet "Livrés" (livre)
- Carte/Planning avec adresses
- Optimisation de tournée (si activé)

#### Carte Dossier
```
┌──────────────────────────────────────────────────┐
│ [Bande colorée selon statut]                     │
│                                                   │
│  CMD-2025-001          [Badge Statut]            │
│  📍 123 Rue de Paris, 75001 Paris                │
│  📞 06 12 34 56 78                               │
│  👤 Client: Entreprise XYZ                        │
│  🕐 Prévu: 16/10/2025 10:00                      │
│                                                   │
│  [👁️ Voir Détails]  [🚚 Livrer]                │
└──────────────────────────────────────────────────┘
```

---

## 👑 5. ADMINISTRATEUR

### 🎯 **Permissions**
- ✅ **ACCÈS COMPLET** à tous les dossiers
- ✅ Voir tous les statuts
- ✅ Modifier tous les statuts (même rollback)
- ✅ Créer/Modifier/Supprimer tout dossier
- ✅ Voir les dossiers de tous les utilisateurs
- ✅ Gérer les utilisateurs
- ✅ Accéder aux statistiques
- ✅ Forcer transitions non standard
- ✅ Débloquer dossiers

### 📊 **Statuts Visibles**

**TOUS LES STATUTS** (9 statuts complets)

| Statut | Code | Couleur | Toujours Visible |
|--------|------|---------|------------------|
| Nouveau | `nouveau` | 🔵 Bleu | ✅ |
| En cours | `en_cours` | 🟡 Jaune | ✅ |
| À revoir | `a_revoir` | 🔴 Rouge | ✅ |
| Prêt impression | `pret_impression` | 🟣 Violet | ✅ |
| En impression | `en_impression` | 🟦 Indigo | ✅ |
| Imprimé | `imprime` | 🔷 Cyan | ✅ |
| Prêt livraison | `pret_livraison` | 🟣 Violet | ✅ |
| En livraison | `en_livraison` | 🟣 Violet | ✅ |
| Livré | `livre` | 🟢 Vert | ✅ |
| Terminé | `termine` | ⚪ Gris | ✅ |

### 🎛️ **Boutons Disponibles par Statut**

#### **Principe: Agrégation**
L'admin voit **TOUS les boutons de TOUS les rôles** pour le statut actuel, plus des actions spéciales.

---

#### **Statut: En cours** 🟡
```
┌────────────────────────────────────────┐
│  📋 Marquer prêt pour impression       │  (Préparateur)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  🔄 Demander révision                  │  (Admin spécial)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ⚡ Forcer transition                  │  (Admin spécial)
└────────────────────────────────────────┘
```

---

#### **Statut: À revoir** 🔴
```
┌────────────────────────────────────────┐
│  📋 Marquer prêt pour impression       │  (Préparateur)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ◀️ Remettre en cours                  │  (Admin rollback)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ⚡ Forcer transition                  │  (Admin spécial)
└────────────────────────────────────────┘
```

---

#### **Statut: Prêt impression** 🟣
```
┌────────────────────────────────────────┐
│  🖨️ Démarrer impression                │  (Imprimeur)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  🔄 Renvoyer à revoir                  │  (Imprimeur)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ◀️ Remettre en cours                  │  (Admin rollback)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ⚡ Forcer transition                  │  (Admin spécial)
└────────────────────────────────────────┘
```

---

#### **Statut: En impression** 🟦
```
┌────────────────────────────────────────┐
│  ✅ Marquer comme imprimé              │  (Imprimeur)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  🔄 Renvoyer à revoir                  │  (Imprimeur)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ◀️ Annuler impression                 │  (Admin rollback)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ⚡ Forcer transition                  │  (Admin spécial)
└────────────────────────────────────────┘
```

---

#### **Statut: Prêt livraison** 🟣
```
┌────────────────────────────────────────┐
│  🚚 Démarrer livraison                 │  (Livreur)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  📦 Livrer directement                 │  (Livreur)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ◀️ Remettre en impression             │  (Admin rollback)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ⚡ Forcer transition                  │  (Admin spécial)
└────────────────────────────────────────┘
```

---

#### **Statut: En livraison** 🟣
```
┌────────────────────────────────────────┐
│  ✅ Marquer comme livré                │  (Livreur)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ◀️ Annuler livraison                  │  (Admin rollback)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ⚡ Forcer transition                  │  (Admin spécial)
└────────────────────────────────────────┘
```

---

#### **Statut: Livré** 🟢
```
┌────────────────────────────────────────┐
│  🏁 Marquer comme terminé              │  (Livreur)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ◀️ Remettre en livraison              │  (Admin rollback)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ⚡ Forcer transition                  │  (Admin spécial)
└────────────────────────────────────────┘
```

---

#### **Statut: Terminé** ⚪
```
┌────────────────────────────────────────┐
│  ◀️ Rouvrir le dossier                 │  (Admin rollback)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ⚡ Forcer transition                  │  (Admin spécial)
└────────────────────────────────────────┘
```

---

### 🔧 **Bouton Spécial: Forcer Transition**

Lorsque l'admin clique sur "⚡ Forcer transition", une modal s'ouvre :

```
┌──────────────────────────────────────────┐
│  ⚡ Forcer Transition Manuelle           │
├──────────────────────────────────────────┤
│                                          │
│  Statut actuel: [En impression]          │
│                                          │
│  Nouveau statut:                         │
│  [Dropdown avec tous les statuts]        │
│    ├─ En cours                           │
│    ├─ À revoir                           │
│    ├─ Prêt impression                    │
│    ├─ En impression (actuel)             │
│    ├─ Prêt livraison                     │
│    ├─ En livraison                       │
│    ├─ Livré                              │
│    └─ Terminé                            │
│                                          │
│  Commentaire (obligatoire):              │
│  [Textarea]                              │
│                                          │
│  ⚠️  Cette action est irréversible       │
│                                          │
│  [Annuler]  [Forcer le changement]      │
└──────────────────────────────────────────┘
```

**Utilité**: Débloquer situations exceptionnelles, corriger erreurs, tester workflow.

---

### 📱 **Interface Administrateur**

#### Dashboard Principal
```
┌─────────────────────────────────────────────────┐
│  📊 TABLEAU DE BORD ADMIN                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  [En cours: 12]  [Impression: 8]  [Livraison: 5]│
│  [Terminés: 45]  [À revoir: 3]                  │
│                                                 │
│  Filtres:                                       │
│  [Tous] [Par rôle ▼] [Par statut ▼] [Par date ▼]│
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  CMD-2025-001  [En impression]  Roland    │ │
│  │  👤 Jean Dupont (Préparateur)              │ │
│  │  [👁️ Voir] [⚡ Forcer] [🗑️ Supprimer]    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  CMD-2025-002  [Prêt livraison]  Xerox    │ │
│  │  👤 Marie Martin (Préparateur)             │ │
│  │  [👁️ Voir] [⚡ Forcer] [🗑️ Supprimer]    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Menu Admin Supplémentaire
- 👥 Gestion utilisateurs
- 📈 Statistiques avancées
- 🗂️ Gestion fichiers orphelins
- ⚙️ Configuration système
- 💰 Gestion paiements
- 📋 Historique complet

---

## 📊 TABLEAU RÉCAPITULATIF COMPLET

### Vue d'ensemble par Rôle et Statut

| Statut | Préparateur | Imprimeur Roland/Xerox | Livreur | Admin |
|--------|-------------|------------------------|---------|-------|
| **nouveau** | ✅ Voit<br/>📋 Valider | ❌ Ne voit pas | ❌ Ne voit pas | ✅ Voit<br/>📋 Valider<br/>⚡ Forcer |
| **en_cours** | ✅ Voit<br/>📋 Valider<br/>🗑️ Supprimer | ❌ Ne voit pas | ❌ Ne voit pas | ✅ Voit<br/>📋 Valider<br/>🔄 Réviser<br/>⚡ Forcer |
| **a_revoir** | ✅ Voit<br/>📋 Revalider | ❌ Ne voit pas | ❌ Ne voit pas | ✅ Voit<br/>📋 Revalider<br/>◀️ Rollback<br/>⚡ Forcer |
| **pret_impression** | ✅ Voit (read-only) | ✅ Voit<br/>🖨️ Démarrer<br/>🔄 Revoir ⚠️ | ❌ Ne voit pas | ✅ Voit<br/>🖨️ Démarrer<br/>🔄 Revoir<br/>◀️ Rollback<br/>⚡ Forcer |
| **en_impression** | ❌ Ne voit pas<br/>(🔄 Revoir ⚠️ bug) | ✅ Voit<br/>✅ Imprimé<br/>🔄 Revoir ⚠️ | ❌ Ne voit pas | ✅ Voit<br/>✅ Imprimé<br/>🔄 Revoir<br/>◀️ Rollback<br/>⚡ Forcer |
| **imprime** | ❌ Ne voit pas | ✅ Voit<br/>📦 Prêt livraison | ❌ Ne voit pas | ✅ Voit<br/>📦 Prêt livraison<br/>⚡ Forcer |
| **pret_livraison** | ❌ Ne voit pas<br/>(🔄 Revoir ⚠️ bug) | ✅ Voit (read-only)<br/>(🔄 Revoir ⚠️) | ✅ Voit<br/>🚚 Livrer<br/>(📦 Direct ⚠️ missing) | ✅ Voit<br/>🚚 Livrer<br/>📦 Direct<br/>◀️ Rollback<br/>⚡ Forcer |
| **en_livraison** | ❌ Ne voit pas | ❌ Ne voit pas | ✅ Voit<br/>✅ Livré | ✅ Voit<br/>✅ Livré<br/>◀️ Rollback<br/>⚡ Forcer |
| **livre** | ❌ Ne voit pas | ❌ Ne voit pas | ✅ Voit<br/>🏁 Terminer | ✅ Voit<br/>🏁 Terminer<br/>◀️ Rollback<br/>⚡ Forcer |
| **termine** | ❌ Ne voit pas | ❌ Ne voit pas | ✅ Voit (read-only) | ✅ Voit<br/>◀️ Rouvrir<br/>⚡ Forcer |

### Légende
- ✅ Voit : Peut voir les dossiers dans ce statut
- ❌ Ne voit pas : Aucun accès
- 📋 Action métier normale
- 🔄 Action de rollback/révision
- ◀️ Action de rollback admin
- ⚡ Forcer transition (admin only)
- ⚠️ Problème identifié (voir détails)

---

## 🎨 COULEURS DES STATUTS

### Palette Unifiée

```
nouveau          ████ Bleu      bg-blue-500    text-blue-600
en_cours         ████ Jaune     bg-yellow-500  text-yellow-600
a_revoir         ████ Rouge     bg-red-500     text-red-600
pret_impression  ████ Violet    bg-purple-500  text-purple-600
en_impression    ████ Indigo    bg-indigo-500  text-indigo-600
imprime          ████ Cyan      bg-cyan-500    text-cyan-600
pret_livraison   ████ Violet    bg-violet-500  text-violet-600
en_livraison     ████ Violet    bg-violet-500  text-violet-600
livre            ████ Vert      bg-green-500   text-green-600
termine          ████ Gris      bg-gray-500    text-gray-600
```

### Application Visuelle

**Badge de statut** :
```html
<span class="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-md">
  Nouveau
</span>
```

**Bande colorée** (haut de carte) :
```html
<div class="h-1.5 bg-blue-500"></div>
```

---

## ⚠️ PROBLÈMES IDENTIFIÉS

### 🔴 Haute Priorité

**1. Transition "Renvoyer à revoir" pour Imprimeurs**
- **Statuts affectés**: `pret_impression`, `en_impression`
- **Problème**: Bouton affiché mais transition non définie backend
- **Erreur**: 403 Forbidden
- **Solution**: Ajouter transitions dans `backend/services/workflow-adapter.js`

**2. Boutons Préparateur sur statuts inaccessibles**
- **Statuts affectés**: `en_impression`, `pret_livraison`
- **Problème**: Préparateur ne devrait pas voir ces statuts
- **Solution**: Retirer boutons dans `frontend/workflow-adapter/workflowActions.js`

### 🟡 Moyenne Priorité

**3. Statut "imprime" intermédiaire**
- **Problème**: Existe dans frontend, pas dans backend
- **Impact**: Confusion workflow
- **Solution**: Décider si garder ou supprimer

**4. Livraison directe manquante**
- **Problème**: Backend autorise `pret_livraison` → `livre`, pas de bouton frontend
- **Impact**: Fonctionnalité inutilisée
- **Solution**: Ajouter bouton "Livrer directement"

---

## 📈 FLUX WORKFLOW COMPLET

### Diagramme de Flux

```
┌──────────────┐
│   NOUVEAU    │  🔵 Préparateur crée le dossier
└──────┬───────┘
       │ Prépare fichiers
       ↓
┌──────────────┐
│  EN COURS    │  🟡 Préparateur travaille
└──────┬───────┘
       │ Valide OU ← Corrections
       ↓          ↑
┌──────────────┐  │
│PRÊT IMPRESS. │  🟣 Prêt pour imprimeur
└──────┬───────┘  │
       │          │ Si problème: À REVOIR 🔴
       ↓          │
┌──────────────┐  │
│ EN IMPRESS.  │  🟦 Imprimeur imprime ──┘
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   IMPRIMÉ    │  🔷 Impression terminée (frontend only)
└──────┬───────┘
       │
       ↓
┌──────────────┐
│PRÊT LIVRAISON│  🟣 Prêt pour livreur
└──────┬───────┘
       │
       ├────────────┐ Livraison directe (admin/livreur)
       ↓            ↓
┌──────────────┐    │
│EN LIVRAISON  │ 🟣 │ Livraison programmée
└──────┬───────┘    │
       │            │
       ↓            │
┌──────────────┐    │
│    LIVRÉ     │  🟢◄┘ Client a reçu
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   TERMINÉ    │  ⚪ Archivé
└──────────────┘
```

### Temps Moyen par Étape

| Étape | Durée Moyenne | Acteur |
|-------|---------------|--------|
| Nouveau → En cours | Immédiat | Préparateur |
| En cours → Prêt impression | 30-60 min | Préparateur |
| Prêt → En impression | 5-10 min | Imprimeur |
| En impression → Imprimé | 15-120 min | Imprimeur |
| Imprimé → Prêt livraison | Immédiat | Imprimeur |
| Prêt livraison → En livraison | Variable | Livreur |
| En livraison → Livré | 1-24h | Livreur |
| Livré → Terminé | 1-7 jours | Auto/Livreur |

---

## 🔔 NOTIFICATIONS PAR ÉVÉNEMENT

### Qui Reçoit Quoi ?

| Événement | Préparateur | Imprimeur | Livreur | Admin |
|-----------|-------------|-----------|---------|-------|
| Dossier créé | ✅ Créateur | ❌ | ❌ | ✅ |
| Validé (prêt impression) | ✅ Créateur | ✅ Concerné | ❌ | ✅ |
| Impression démarrée | ✅ Créateur | ✅ Responsable | ❌ | ✅ |
| Imprimé (prêt livraison) | ✅ Créateur | ✅ Responsable | ✅ | ✅ |
| Demande révision | ✅ Créateur | ❌ | ❌ | ✅ |
| Livraison démarrée | ✅ Créateur | ❌ | ✅ Responsable | ✅ |
| Livré | ✅ Créateur | ❌ | ✅ Responsable | ✅ |
| Terminé | ✅ Créateur | ❌ | ❌ | ✅ |

---

## 📝 RÉSUMÉ PAR RÔLE

### 📋 Préparateur
**Ce qu'il fait** : Crée et prépare les dossiers avec fichiers  
**Ce qu'il voit** : Ses dossiers (nouveau → a_revoir)  
**Ses boutons** : Valider, Revalider, Supprimer  
**Son workflow** : Nouveau → En cours → Prêt impression

### 🖨️ Imprimeur Roland/Xerox
**Ce qu'il fait** : Imprime les dossiers de sa machine  
**Ce qu'il voit** : Dossiers prêts → imprimés de sa machine  
**Ses boutons** : Démarrer, Imprimé, Prêt livraison, (Revoir)  
**Son workflow** : Prêt impression → En impression → Imprimé → Prêt livraison

### 🚚 Livreur
**Ce qu'il fait** : Livre les dossiers imprimés  
**Ce qu'il voit** : Dossiers prêts livraison → terminés  
**Ses boutons** : Démarrer livraison, Livré, Terminer  
**Son workflow** : Prêt livraison → En livraison → Livré → Terminé

### 👑 Admin
**Ce qu'il fait** : Supervise et débloquer situations  
**Ce qu'il voit** : TOUS les dossiers, TOUS les statuts  
**Ses boutons** : TOUS + Forcer transition + Rollback  
**Son workflow** : Peut tout faire, dans tous les sens

---

**Document créé le**: 17 octobre 2025  
**Version**: 1.0  
**Auteur**: GitHub Copilot  
**Statut**: ✅ Documentation complète et détaillée
