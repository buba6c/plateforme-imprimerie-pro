# 🎯 GUIDE D'UTILISATION RAPIDE

## 🚀 Démarrage immédiat

### 1. Lancer la plateforme
```bash
./start.sh
```

### 2. Se connecter
- **URL** : http://localhost:3000
- **Comptes disponibles** :
  - Admin : `admin@imprimerie.local` / `admin123`
  - Préparateur : `preparateur@imprimerie.local` / `admin123` 
  - Roland : `roland@imprimerie.local` / `admin123`
  - Xerox : `xerox@imprimerie.local` / `admin123`
  - Livreur : `livreur@imprimerie.local` / `admin123`

---

## 👤 GUIDE PAR RÔLE

### 🔧 PRÉPARATEUR (Marie)
**Que je peux faire :**
- ✅ Créer de nouvelles commandes
- ✅ Voir mes commandes `en_cours` et `a_revoir`
- ✅ Corriger les commandes renvoyées par les imprimeurs
- ✅ Modifier mes commandes non encore prises par les imprimeurs

**Actions typiques :**
1. Cliquer "**Nouveau dossier**"
2. Remplir les informations client
3. Choisir type machine (**Roland** ou **Xerox**)
4. Suivre les retours des imprimeurs

### 🖨️ IMPRIMEUR ROLAND (Pierre)  
**Que je peux faire :**
- ✅ Voir toutes les commandes **type Roland** 
- ✅ Prendre en charge les commandes `en_cours`
- ✅ Marquer `en_impression` quand je commence
- ✅ Renvoyer `a_revoir` si problème
- ✅ Finaliser `termine` quand c'est prêt

**Actions typiques :**
1. Regarder les nouvelles commandes Roland
2. Cliquer "**Commencer impression**" 
3. Si problème → "**Demander révision**" + commentaire
4. Sinon → "**Terminer impression**"

### 🖨️ IMPRIMEUR XEROX (identique à Roland)
Mêmes actions mais pour les commandes **type Xerox** uniquement.

### 🚚 LIVREUR (Paul)
**Que je peux faire :**
- ✅ Voir commandes `termine`, `en_livraison`, `livre`
- ✅ Prendre en charge les commandes terminées  
- ✅ Marquer `en_livraison` quand je pars
- ✅ Finaliser `livre` après livraison

**Actions typiques :**
1. Regarder les commandes prêtes (`termine`)
2. "**Prendre en livraison**" 
3. "**Confirmer livraison**" une fois fait

### 👑 ADMIN (Jean)
**Que je peux faire :**
- ✅ Voir TOUS les dossiers tout le temps
- ✅ Toutes les actions de tous les rôles
- ✅ Supprimer les dossiers
- ✅ Gérer les utilisateurs
- ✅ Surveillance globale

---

## 🔄 WORKFLOW SIMPLIFIÉ

```
📝 NOUVEAU → 🖨️ IMPRESSION → 🚚 LIVRAISON → ✅ TERMINÉ
   (Préparateur)   (Imprimeur)      (Livreur)
       ↕️              ↕️
   🔄 A_REVOIR ←→ 📝 EN_COURS
   (Corrections)   (Prêt impression)
```

### États expliqués :
- **`en_cours`** = Nouveau dossier, prêt pour impression
- **`a_revoir`** = L'imprimeur demande des précisions  
- **`en_impression`** = L'imprimeur travaille dessus
- **`termine`** = Impression finie, prêt pour livraison
- **`en_livraison`** = Le livreur est parti livrer
- **`livre`** = Livraison effectuée, dossier clos

---

## 📱 INTERFACE INTUITIVE

### 📊 Dashboard
- **Liste des dossiers** que je peux voir (selon mon rôle)
- **Boutons d'action** adaptés à chaque statut
- **Notifications temps réel** quand ça bouge

### 🔔 Notifications  
- **🟢 Vert** = Nouveau dossier pour moi
- **🟡 Orange** = Dossier modifié  
- **🔴 Rouge** = Urgent ou problème
- **🔵 Bleu** = Information

### 💬 Commentaires
- **Obligatoire** pour "Demander révision"
- **Recommandé** pour toutes les transitions
- **Visible** par tous les rôles concernés

---

## ⚡ RACCOURCIS CLAVIER

- **Ctrl+N** : Nouveau dossier (Préparateur/Admin)
- **Ctrl+R** : Actualiser la liste
- **Échap** : Fermer les modales
- **Entrée** : Valider les actions

---

## 🆘 PROBLÈMES COURANTS

### ❓ "Je ne vois pas un dossier"
➡️ **Normal !** Vous ne voyez que les dossiers de votre rôle dans les bons statuts.

### ❓ "Je ne peux pas changer un statut"
➡️ Vérifiez que c'est votre tour dans le workflow.

### ❓ "Rien ne se passe"
➡️ Actualisez (Ctrl+R) ou vérifiez votre connexion Internet.

### ❓ "L'impression ne démarre pas"
➡️ Vérifiez PM2 : `pm2 status` dans un terminal.

---

## 📞 CONTACTS

- **Admin système** : Jean (`admin@imprimerie.local`)
- **Aide technique** : Consulter les logs avec `pm2 logs`
- **Formation** : Ce guide + dossiers de test présents

---

*Guide d'utilisation - Plateforme Imprimerie V3*  
*🟢 Système opérationnel - Prêt à l'emploi*