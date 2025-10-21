# 📋 LISTE COMPLÈTE DES BOUTONS PAR RÔLE

## 🎯 **SYSTÈME DE BOUTONS ET PERMISSIONS**

### 📊 **Mapping des Statuts**
```
Frontend → Backend:
- en_cours → "En cours" (PREPARATION)
- pret_impression → "Prêt impression" (READY)
- a_revoir → "À revoir" (REVISION)  
- en_impression → "En impression" (IN_PROGRESS)
- termine → "Terminé" (COMPLETED)
- imprime → "Imprimé" (COMPLETED variant)
- pret_livraison → "Prêt livraison" (COMPLETED variant)
- en_livraison → "En livraison" (IN_DELIVERY)
- livre → "Livré" (DELIVERED)
```

---

## 👤 **1. ADMIN** 
> **Accès :** Tous les dossiers, toutes les transitions possibles

### 🎛️ **Boutons selon le statut du dossier :**

#### **📝 EN COURS (PREPARATION)**
- **✅ Valider** → `pret_impression` (Prêt impression)
- **🔄 Marquer À revoir** → `a_revoir` (À revoir)

#### **🔄 À REVOIR (REVISION)**  
- **🔄 Revalider** → `pret_impression` (Prêt impression)
- **📝 Remettre en préparation** → `en_cours` (En cours)

#### **⏳ PRÊT IMPRESSION (READY)**
- **▶️ Démarrer l'impression** → `en_impression` (En impression)
- **◀️ Remettre en préparation** → `en_cours` (En cours)

#### **⚙️ EN IMPRESSION (IN_PROGRESS)**
- **✅ Terminer l'impression** → `termine` (Terminé/Imprimé)
- **↩️ Renvoyer au Préparateur** → `a_revoir` (À revoir)
- **◀️ Remettre en attente** → `pret_impression` (Prêt impression)

#### **✅ TERMINÉ/IMPRIMÉ (COMPLETED)**
- **🚚 Prendre en livraison** → `en_livraison` (En livraison)
- **◀️ Remettre en impression** → `en_impression` (En impression) ✨ **CORRIGÉ**

#### **🚚 EN LIVRAISON (IN_DELIVERY)**
- **📦 Valider livraison (Terminer)** → `livre` (Livré)
- **◀️ Annuler livraison** → `termine` (Terminé)

#### **📦 LIVRÉ (DELIVERED)**
- **🔄 Remettre en livraison** → `en_livraison` (En livraison)

### 🔧 **Boutons spéciaux Admin :**
- **🔓 Déverrouiller dossier** (si dossier validé bloqué)
- **🗑️ Supprimer dossier** (permission exclusive)
- **📁 Gérer fichiers** (upload/suppression)
- **👥 Assigner préparateur** (fonction d'assignation)

---

## 👨‍🔧 **2. PRÉPARATEUR**
> **Accès :** Uniquement ses propres dossiers créés

### 🎛️ **Boutons selon le statut :**

#### **📝 EN COURS (PREPARATION)** 
- **✅ Valider** → `pret_impression` (Prêt impression)
- **🔄 Marquer À revoir** → `a_revoir` (À revoir)

#### **🔄 À REVOIR (REVISION)**
- **🔄 Revalider** → `pret_impression` (Prêt impression)

#### **⏳ PRÊT IMPRESSION (READY)**
- **◀️ Remettre en préparation** → `en_cours` (En cours)

### 🔧 **Boutons spéciaux Préparateur :**
- **📁 Upload fichiers** (sur ses dossiers)
- **✅ Validation officielle** (route spéciale `/valider`)
- **📝 Modifier dossier** (update complet)

---

## 🖨️ **3. IMPRIMEUR ROLAND**
> **Accès :** Dossiers machine "Roland" aux statuts de production

### 🎛️ **Boutons selon le statut :**

#### **⏳ PRÊT IMPRESSION (READY)** [Machine Roland]
- **▶️ Démarrer l'impression** → `en_impression` (En impression)

#### **⚙️ EN IMPRESSION (IN_PROGRESS)** [Machine Roland]
- **✅ Terminer l'impression** → `pret_livraison` ✨ (Auto-mapping vers livreur)
- **↩️ Renvoyer au Préparateur** → `a_revoir` (À revoir)

### 🔧 **Restrictions :**
- ❌ Accès seulement aux dossiers `machine: "Roland"`
- ❌ Pas d'accès aux fichiers des autres machines
- ✅ Upload fichiers (résultats d'impression)

---

## 🖨️ **4. IMPRIMEUR XEROX** 
> **Accès :** Dossiers machine "Xerox" aux statuts de production

### 🎛️ **Boutons selon le statut :**

#### **⏳ PRÊT IMPRESSION (READY)** [Machine Xerox]
- **▶️ Démarrer l'impression** → `en_impression` (En impression)

#### **⚙️ EN IMPRESSION (IN_PROGRESS)** [Machine Xerox]  
- **✅ Terminer l'impression** → `pret_livraison` ✨ (Auto-mapping vers livreur)
- **↩️ Renvoyer au Préparateur** → `a_revoir` (À revoir)

### 🔧 **Restrictions :**
- ❌ Accès seulement aux dossiers `machine: "Xerox"`  
- ❌ Pas d'accès aux fichiers des autres machines
- ✅ Upload fichiers (résultats d'impression)

---

## 🚚 **5. LIVREUR**
> **Accès :** Dossiers prêts/en cours de livraison

### 🎛️ **Boutons selon le statut :**

#### **✅ TERMINÉ/PRÊT LIVRAISON (COMPLETED)**
- **🚚 Prendre en livraison** → `en_livraison` (En livraison) ✨ **CORRIGÉ**

#### **🚚 EN LIVRAISON (IN_DELIVERY)** 
- **📦 Confirmer livraison** → `livre` (Livré) ✨ **CORRIGÉ**

### 🔧 **Boutons spéciaux Livreur :**
- **📅 Programmer livraison** (avec date prévue) ✨ **CORRIGÉ**
- **💰 Confirmer paiement** (montant + mode de paiement) ✨ **CORRIGÉ**
- **📁 Upload preuves** (photos livraison, signatures)

---

## 🔧 **CORRECTIONS APPLIQUÉES**

### ✅ **Problèmes résolus :**

1. **Route API unifiée :** Tous les rôles utilisent `PATCH /dossiers/:id/status` avec permission `'change_status'` ✨

2. **Mapping cohérent :**
   ```javascript
   // Service frontend corrigé
   changeStatus → PATCH /status
   scheduleDelivery → PATCH /status  ✨ NOUVEAU
   confirmDelivery → PATCH /status   ✨ NOUVEAU
   ```

3. **Permissions backend :**
   ```javascript
   'change_status': ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur']
   'update': ['admin', 'preparateur'] // Route PUT /statut
   ```

---

## 📋 **RÉSUMÉ PAR FONCTIONNALITÉ**

### 🎯 **Actions de Workflow :**
| Action | Admin | Prep | I.Roland | I.Xerox | Livreur |
|--------|-------|------|----------|---------|---------|
| Valider dossier | ✅ | ✅ | ❌ | ❌ | ❌ |
| Démarrer impression | ✅ | ❌ | ✅* | ✅* | ❌ |
| Terminer impression | ✅ | ❌ | ✅* | ✅* | ❌ |
| Prendre en livraison | ✅ | ❌ | ❌ | ❌ | ✅ |
| Confirmer livraison | ✅ | ❌ | ❌ | ❌ | ✅ |
| Remettre en impression | ✅ | ❌ | ❌ | ❌ | ❌ |
| Renvoyer au préparateur | ✅ | ❌ | ✅* | ✅* | ❌ |

*Seulement pour leur machine respective

### 📁 **Gestion des Fichiers :**
| Action | Admin | Prep | I.Roland | I.Xerox | Livreur |
|--------|-------|------|----------|---------|---------|
| Upload fichiers | ✅ | ✅ | ✅* | ✅* | ✅ |
| Télécharger fichiers | ✅ | ✅ | ✅* | ✅* | ✅ |
| Supprimer fichiers | ✅ | ❌ | ❌ | ❌ | ❌ |
| Voir tous fichiers | ✅ | ✅ | ❌ | ❌ | ❌ |

*Seulement les fichiers de leur machine/dossiers autorisés

### 🔒 **Permissions Spéciales :**
| Permission | Admin | Prep | I.Roland | I.Xerox | Livreur |
|------------|-------|------|----------|---------|---------|
| Créer dossier | ✅ | ✅ | ❌ | ❌ | ❌ |
| Modifier dossier | ✅ | ✅* | ❌ | ❌ | ❌ |
| Supprimer dossier | ✅ | ❌ | ❌ | ❌ | ❌ |
| Déverrouiller dossier | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assigner preparateur | ✅ | ❌ | ❌ | ❌ | ❌ |

*Seulement ses propres dossiers

---

## 🚀 **ÉTAT ACTUEL**

**✅ TOUS LES BOUTONS FONCTIONNENT CORRECTEMENT !**

- ✅ Admin : Contrôle total avec bouton "Remettre en impression" corrigé
- ✅ Préparateur : Validation et gestion de ses dossiers  
- ✅ Imprimeur Roland : Actions d'impression Roland uniquement
- ✅ Imprimeur Xerox : Actions d'impression Xerox uniquement
- ✅ Livreur : Gestion complète des livraisons corrigée

**Plus aucun message "Dossier non trouvé" !** 🎉