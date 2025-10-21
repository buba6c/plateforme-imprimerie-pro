# 🔄 Guide d'Utilisation - Conversion Devis → Dossier

## 📋 **Comment voir et utiliser le bouton "Convertir en dossier"**

### 🎯 **Étapes pour convertir un devis en dossier**

#### 1. **Accéder à vos devis**
- Connectez-vous en tant que **Préparateur**
- Allez dans **"Mes devis"** dans le menu

#### 2. **Voir les détails d'un devis**
- Cliquez sur l'icône **👁️ (œil)** pour voir les détails d'un devis
- Un modal s'ouvre avec tous les détails du devis

#### 3. **Statuts et boutons disponibles**

| Statut du Devis | Boutons Visibles | Action |
|------------------|------------------|--------|
| 📝 **Brouillon** | `Valider le devis` | Valide le devis (passage à "Validé") |
| ⏳ **En attente** | `Valider le devis` | Valide le devis (passage à "Validé") |
| ✅ **Validé** | `Convertir en dossier` | Convertit en dossier (irréversible) |
| ❌ **Refusé** | *(aucun bouton)* | - |
| 🔄 **Converti** | *(aucun bouton)* | Déjà converti |

#### 4. **Workflow complet**

```
📝 Créer devis → 🤖 Estimation IA → ✅ Valider → 🔄 Convertir → 📁 Dossier
```

---

## 🚀 **Procédure Étape par Étape**

### **ÉTAPE 1: Créer un devis**
1. Menu → **"Créer un devis"**
2. Choisir **Roland** ou **Xerox**
3. Remplir le formulaire
4. 🤖 Le système estime automatiquement le prix
5. Cliquer **"Créer le devis"**
6. ➡️ Statut: **"Brouillon"**

### **ÉTAPE 2: Valider le devis**
1. Menu → **"Mes devis"**
2. Cliquer sur **👁️** pour voir les détails
3. Cliquer sur **"Valider le devis"** (bouton bleu)
4. Confirmer la validation
5. ➡️ Statut: **"Validé"**

### **ÉTAPE 3: Convertir en dossier**
1. Dans le même modal de détails
2. Le bouton **"Convertir en dossier"** (vert) apparaît maintenant
3. Cliquer sur **"Convertir en dossier"**
4. Confirmer la conversion (⚠️ **irréversible**)
5. ➡️ Statut: **"Converti"** + Création automatique du dossier

---

## 🔍 **Troubleshooting - "Je ne vois pas le bouton"**

### ✅ **Vérifications à faire :**

1. **Rôle utilisateur**
   - Vous devez être connecté en tant que **Préparateur**
   - Les autres rôles ne peuvent pas convertir

2. **Statut du devis**
   - Le bouton n'apparaît que si le statut est **"Validé"**
   - Si votre devis est en "Brouillon", cliquez d'abord sur **"Valider le devis"**

3. **Permissions**
   - Vous ne pouvez convertir que **vos propres devis**
   - Un admin peut voir tous les devis mais ne peut pas les convertir

4. **Devis déjà converti**
   - Si le statut est **"Converti"**, la conversion a déjà eu lieu
   - Le dossier correspondant existe déjà dans le système

### 🎯 **Interface détaillée :**

```
┌─────────────────────────────────────────┐
│ 📋 Devis DEV-2025-001                   │
├─────────────────────────────────────────┤
│ [Prévisualiser] [Valider] [Convertir]   │ ← Boutons selon statut
│                                         │
│ ✅ Statut: Validé                       │ ← Doit être "Validé"
│ 💰 Prix: 15,000 FCFA                   │
│ 📅 Créé le: 09/10/2025                 │
└─────────────────────────────────────────┘
```

---

## 📊 **Après la Conversion**

### 🎯 **Ce qui se passe automatiquement :**

1. **Création du dossier**
   - UUID unique généré
   - Toutes les données transférées
   - Statut initial: "En cours"

2. **Marquage du devis**
   - Statut changé en "Converti"
   - Lien créé vers le dossier
   - Horodatage de la conversion

3. **Workflow activé**
   - Le dossier apparaît dans les interfaces Imprimeur
   - Workflow d'impression démarré
   - Notifications envoyées

### 📁 **Retrouver le dossier créé :**
- Menu → **"Gestion des dossiers"**
- Le nouveau dossier apparaît avec le statut "En cours"
- Référence au devis d'origine conservée

---

## 🎉 **Workflow Complet Opérationnel**

```
PRÉPARATEUR              IMPRIMEUR              LIVREUR
     │                        │                      │
📝 Crée devis          🖨️ Imprime           🚚 Livre
✅ Valide              ✅ Termine            💰 Facture auto
🔄 Convertit           📦 Prêt               ✅ Paiement
     │                        │                      │
     └────────── DOSSIER ──────────────────────────────┘
```

### 🎯 **Résultat final :**
- ✅ Devis professionnel créé
- ✅ Dossier d'impression généré
- ✅ Workflow automatisé activé
- ✅ Facture générée automatiquement à la livraison

---

## 💡 **Conseils d'Utilisation**

1. **Toujours valider avant de convertir**
   - Vérifiez le prix estimé
   - Ajustez si nécessaire le prix final
   - La conversion utilise ces données

2. **Conversion irréversible**
   - Une fois converti, impossible de revenir
   - Le devis devient "historique"
   - Toute modification se fait sur le dossier

3. **Suivi du workflow**
   - Suivez l'avancement dans "Gestion des dossiers"
   - Les notifications vous tiennent informé
   - La facture est générée automatiquement

**Le système est maintenant prêt à automatiser votre processus commercial complet ! 🚀**