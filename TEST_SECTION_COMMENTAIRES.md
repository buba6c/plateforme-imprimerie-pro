# 🧪 Guide de Test - Section Commentaires de Révision

## 🎯 Objectif du Test

Valider que la nouvelle section **"Commentaire de révision"** fonctionne correctement et s'affiche selon les bonnes permissions.

---

## 📋 Pré-requis

### Comptes de Test Requis

1. **Admin** : `admin@plateforme.com` / mot de passe admin
2. **Préparateur** : Compte préparateur (créateur de dossiers)
3. **Imprimeur Roland** : Compte imprimeur_roland
4. **Imprimeur Xerox** : Compte imprimeur_xerox
5. **Livreur** : Compte livreur (test négatif)

### Dossier de Test

Vous aurez besoin d'un dossier existant avec :
- **Statut initial** : "Prêt impression" ou "En impression"
- **Créé par** : Un préparateur
- **Contient** : Au moins 1 fichier

---

## 🧪 Scénario de Test Complet

### ÉTAPE 1 : Demander une Révision (Imprimeur)

**Connexion** : Imprimeur Roland ou Xerox

**Actions** :
1. Accéder à la liste des dossiers
2. Ouvrir un dossier en statut "Prêt impression"
3. **Vérifier** : Le bouton "Demander révision" 🔄 est visible
4. Cliquer sur "Demander révision"
5. **Vérifier** : Modal "💬 Commentaire de révision" s'ouvre
6. Saisir un commentaire : 
   ```
   Fichier incorrect : résolution trop basse (72 DPI au lieu de 300 DPI).
   Merci de fournir une version haute résolution.
   ```
7. Cliquer "Envoyer"
8. **Vérifier** : 
   - Modal se ferme
   - Notification de succès "Statut mis à jour"
   - Badge du dossier devient rouge "À revoir"

---

### ÉTAPE 2 : Vérifier Section Commentaires (Imprimeur)

**Connexion** : Même imprimeur (déjà connecté)

**Actions** :
1. Rouvrir le même dossier
2. **Vérifier la colonne droite** :

```
┌─────────────────────────────────────┐
│ 🎯 Actions                          │  ← Boutons workflow
├─────────────────────────────────────┤
│ 💬 Commentaire de révision         │  ← NOUVELLE SECTION
│ ┌─────────────────────────────────┐ │
│ │ 🔔 RÉVISION DEMANDÉE (animé)   │ │
│ ├─────────────────────────────────┤ │
│ │ [Avatar] Imprimeur Roland       │ │
│ │ 17 oct. 2025 • 14:30           │ │
│ │                                 │ │
│ │ "Fichier incorrect : résolu...│ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ 📜 Historique                       │  ← Historique habituel
└─────────────────────────────────────┘
```

3. **Vérifier les détails** :
   - ✅ En-tête : "💬 Commentaire de révision"
   - ✅ Sous-titre : "Demandé par [Votre nom]"
   - ✅ Badge urgent rouge-orange avec pulse
   - ✅ Avatar avec votre initiale
   - ✅ Date et heure formatées en français
   - ✅ Commentaire complet visible
   - ❌ PAS d'instructions préparateur (vous êtes imprimeur)

4. **Vérifier l'historique** :
   - Scroll dans la section "📜 Historique"
   - Le commentaire apparaît AUSSI dans l'historique avec icône 💬
   - Badge rouge "À revoir"

---

### ÉTAPE 3 : Voir le Commentaire (Préparateur)

**Connexion** : Se déconnecter, puis connecter avec le préparateur qui a créé le dossier

**Actions** :
1. Aller dans "Mes dossiers" ou liste appropriée
2. **Vérifier** : Badge rouge "À revoir" sur la carte du dossier
3. Ouvrir le dossier
4. **Vérifier la section commentaires** :

```
┌─────────────────────────────────────────────┐
│ 💬 Commentaire de révision                  │
│ Demandé par Imprimeur Roland                │
├─────────────────────────────────────────────┤
│ 🔔 RÉVISION DEMANDÉE                        │
├─────────────────────────────────────────────┤
│ [R] Imprimeur Roland    17 oct. • 14:30    │
│                                             │
│ "Fichier incorrect : résolution trop        │
│  basse (72 DPI au lieu de 300 DPI).        │
│  Merci de fournir une version haute         │
│  résolution."                               │
│                                             │
│ ℹ️ Veuillez corriger le(s) fichier(s)      │  ← INSTRUCTIONS
│    selon les instructions ci-dessus,        │
│    puis cliquez sur "Revalider le dossier". │
└─────────────────────────────────────────────┘
```

5. **Vérifier** :
   - ✅ Section visible et en haut de la colonne droite
   - ✅ Instructions préparateur affichées (encadré bleu avec icône ℹ️)
   - ✅ Bouton "Revalider le dossier" visible dans Actions
   - ✅ Commentaire lisible et clair

---

### ÉTAPE 4 : Corriger et Revalider (Préparateur)

**Actions** :
1. Lire attentivement le commentaire
2. Section "📁 Fichiers" :
   - Supprimer le fichier problématique (si admin ou autorisé)
   - OU cliquer "Ajouter des fichiers"
3. Uploader un nouveau fichier haute résolution (300 DPI)
4. Attendre fin de l'upload
5. Bouton "Revalider le dossier" dans section Actions
6. Cliquer "Revalider le dossier"
7. **Vérifier** :
   - Badge devient violet "Prêt impression"
   - Section commentaires DISPARAÎT automatiquement ✅
   - Notification succès

---

### ÉTAPE 5 : Vérifier Disparition (Préparateur)

**Actions** :
1. Rouvrir le dossier (F5 ou fermer/rouvrir)
2. **Vérifier la colonne droite** :

```
┌─────────────────────────────────────┐
│ 🎯 Actions                          │
├─────────────────────────────────────┤
│ (AUCUNE SECTION COMMENTAIRES)      │  ← Disparue !
├─────────────────────────────────────┤
│ 📜 Historique                       │
│ ┌─────────────────────────────────┐ │
│ │ Prêt impression                 │ │  ← Nouveau statut
│ │ Préparateur X                   │ │
│ │ 17 oct. • 14:35                │ │
│ ├─────────────────────────────────┤ │
│ │ À revoir                        │ │  ← Ancien statut
│ │ Imprimeur Roland                │ │
│ │ 💬 "Fichier incorrect..."      │ │  ← Commentaire conservé
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

3. **Vérifier** :
   - ✅ Section commentaires invisible (statut ≠ a_revoir)
   - ✅ Commentaire toujours dans l'historique (traçabilité)
   - ✅ Nouvel événement "Prêt impression" en haut

---

### ÉTAPE 6 : Vérifier Visibilité Admin

**Connexion** : Se connecter en tant qu'admin

**Actions** :
1. Accéder au même dossier
2. Si statut = "À revoir" :
   - ✅ Section commentaires visible
   - ❌ PAS d'instructions préparateur (vous êtes admin)
3. Si statut = "Prêt impression" :
   - ❌ Section commentaires invisible
   - ✅ Commentaire dans l'historique

---

### ÉTAPE 7 : Test Négatif (Livreur)

**Connexion** : Se connecter en tant que livreur

**Actions** :
1. Créer un dossier "À revoir" (ou utiliser existant)
2. Ouvrir le dossier en tant que livreur
3. **Vérifier** :
   - ❌ Section commentaires INVISIBLE (livreur hors scope)
   - ✅ Peut voir le commentaire dans l'historique
   - ✅ Pas de bouton "Demander révision"

---

## ✅ Checklist de Validation

### Affichage Conditionnel
- [ ] Section visible si statut = "À revoir"
- [ ] Section visible pour admin
- [ ] Section visible pour préparateur (créateur)
- [ ] Section visible pour imprimeur (demandeur)
- [ ] Section invisible pour livreur
- [ ] Section disparaît après revalidation

### Contenu
- [ ] En-tête "💬 Commentaire de révision" correct
- [ ] Sous-titre "Demandé par [Auteur]" correct
- [ ] Badge "RÉVISION DEMANDÉE" animé (pulse)
- [ ] Avatar avec initiale correcte
- [ ] Date formatée en français (JJ mois AAAA • HH:MM)
- [ ] Commentaire complet et lisible
- [ ] Instructions préparateur visible uniquement pour préparateur

### Interaction
- [ ] Bouton "Demander révision" fonctionne
- [ ] Modal commentaire s'ouvre
- [ ] Textarea commentaire éditable
- [ ] Bouton "Envoyer" sauvegarde
- [ ] Statut change à "À revoir"
- [ ] Section apparaît immédiatement

### Style
- [ ] Couleurs cohérentes (rouge-orange-ambre)
- [ ] Gradient en-tête correct
- [ ] Bordure gauche rouge visible
- [ ] Badge urgent pulse animation
- [ ] Responsive sur mobile
- [ ] Dark mode fonctionne

### Permissions
- [ ] Admin voit tout
- [ ] Préparateur voit ses dossiers
- [ ] Imprimeur voit ses demandes
- [ ] Livreur ne voit pas
- [ ] Aucune erreur console

---

## 🐛 Bugs à Signaler

### Bug Critique (Blocker)
- Section ne s'affiche pas du tout
- Commentaire vide ou null
- Crash de l'application
- Permissions incorrectes

### Bug Majeur (High Priority)
- Style cassé ou illisible
- Date mal formatée
- Avatar incorrect
- Instructions manquantes

### Bug Mineur (Low Priority)
- Animation pulse trop rapide/lente
- Couleurs légèrement décalées
- Espacement incorrect

---

## 📊 Résultats Attendus

### Succès du Test
✅ Tous les points de la checklist validés  
✅ Aucun bug critique ou majeur  
✅ Expérience utilisateur fluide  
✅ Commentaires clairs et utiles  

### Métriques
- **Temps de test** : ~15-20 minutes
- **Nombre de bugs** : 0-2 mineurs acceptable
- **Satisfaction utilisateur** : 4/5 minimum

---

## 📸 Captures d'Écran Suggérées

1. **Vue imprimeur** : Section avec badge urgent
2. **Vue préparateur** : Section avec instructions
3. **Vue admin** : Section sans instructions
4. **Vue livreur** : Section invisible
5. **Historique** : Commentaire avec icône 💬

---

## 🚀 Prochaines Étapes Après Validation

Si le test est concluant :

1. ✅ Marquer la feature comme terminée
2. 📝 Mettre à jour la documentation utilisateur
3. 🎓 Former les utilisateurs (vidéo/guide)
4. 📊 Activer suivi métriques (taux utilisation)
5. 🔄 Planifier améliorations futures

---

**Date de test** : ________________  
**Testeur** : ________________  
**Résultat** : ☐ PASS  ☐ FAIL  
**Bugs trouvés** : ________________  
**Commentaires** : ________________
