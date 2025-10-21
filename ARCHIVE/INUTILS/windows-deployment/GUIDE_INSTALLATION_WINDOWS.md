# 📋 Guide d'Installation Windows - Plateforme d'Imprimerie Numérique

## 🎯 Objectif
Ce guide vous permet d'installer la plateforme d'imprimerie numérique sur un PC Windows pour un fonctionnement 24h/24 avec accès réseau local.

## ✅ Résultat Final
- ✅ Plateforme accessible 24h/24 même après redémarrage
- ✅ Accessible depuis tous les appareils du réseau local
- ✅ Redémarrage automatique en cas de problème
- ✅ Sauvegarde automatique quotidienne
- ✅ Interface web disponible sur le réseau local

---

## 📋 Prérequis

### Configuration PC Recommandée
- **OS**: Windows 10/11 (64-bit)
- **RAM**: Minimum 8 GB (16 GB recommandé)
- **Stockage**: Minimum 50 GB d'espace libre
- **Réseau**: Connexion Ethernet ou Wi-Fi
- **Privilèges**: Accès administrateur requis

### Éléments Requis
- [ ] PC Windows avec accès administrateur
- [ ] Connexion internet (pour l'installation uniquement)
- [ ] Fichiers de la plateforme (ce dossier)
- [ ] 30-60 minutes de temps d'installation

---

## 🚀 Installation Étape par Étape

### Étape 1: Préparation des Fichiers
1. **Copiez** tous les fichiers de la plateforme sur le PC Windows
2. **Placez** le dossier `windows-deployment` sur le bureau
3. **Ouvrez** PowerShell en tant qu'administrateur :
   - Clic droit sur le bouton Windows → "Windows PowerShell (Admin)"
   - Ou tapez `powershell` dans le menu démarrer → Clic droit → "Exécuter en tant qu'administrateur"

### Étape 2: Installation des Dépendances
```powershell
# Dans PowerShell Administrateur
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
cd "C:\Users\%USERNAME%\Desktop\windows-deployment"
.\install-dependencies.ps1
```

**⚠️ Important**: Un redémarrage est requis après cette étape pour finaliser les installations.

### Étape 3: Configuration de la Plateforme
Après redémarrage, relancez PowerShell en administrateur :
```powershell
cd "C:\Users\%USERNAME%\Desktop\windows-deployment"
.\setup-platform.ps1
```

### Étape 4: Configuration du Démarrage Automatique
```powershell
.\setup-startup.ps1
```

### Étape 5: Configuration de l'Accès Réseau
```powershell
.\setup-network-access.ps1
```

### Étape 6: Configuration des Sauvegardes
```powershell
.\setup-backup.ps1
```

---

## 🔍 Vérification de l'Installation

### Test Local
1. Ouvrez votre navigateur
2. Accédez à : `http://localhost:3001`
3. Vérifiez que la plateforme s'affiche correctement

### Test Réseau
1. **Obtenez l'IP locale** de votre PC :
   ```powershell
   .\test-network-connectivity.ps1
   ```
2. **Depuis un autre appareil** (téléphone, tablette, autre PC), accédez à :
   - `http://[IP-DU-PC]:3001` (exemple: `http://192.168.1.100:3001`)
   - Ou `http://[NOM-DU-PC].local:3001`

### Test de Redémarrage
1. Redémarrez le PC Windows
2. Attendez 2-3 minutes après le démarrage
3. Vérifiez que la plateforme est accessible localement et sur le réseau

---

## 🔧 Scripts de Gestion

### Contrôle de la Plateforme
```powershell
# Démarrer manuellement
cd "C:\Imprimerie-Platform"
.\start-platform.bat

# Arrêter
.\stop-platform.bat

# Vérifier le statut
pm2 status
```

### Gestion des Sauvegardes
```powershell
cd "C:\Imprimerie-Platform"

# Sauvegarde manuelle
.\backup-complete.ps1

# Lister les sauvegardes
.\restore-backup.ps1 -ListBackups

# Restaurer une sauvegarde
.\restore-backup.ps1 -BackupDate "2024-01-15_14-30-00"
```

### Tests et Diagnostics
```powershell
# Test de connectivité réseau
.\test-network-connectivity.ps1

# Surveillance en temps réel
pm2 monit

# Vérification des logs
pm2 logs
```

---

## 📁 Structure des Fichiers Installés

```
C:\Imprimerie-Platform\          # Installation principale
├── backend\                     # Serveur Node.js
├── frontend\                    # Interface React
├── uploads\                     # Fichiers uploadés
├── logs\                        # Journaux système
├── ecosystem.config.js          # Configuration PM2
├── .env                         # Variables environnement
├── backup-complete.ps1          # Script sauvegarde
├── restore-backup.ps1           # Script restauration
├── monitor-platform.ps1        # Script surveillance
└── start-platform.bat          # Démarrage manuel

C:\Imprimerie-Backups\           # Sauvegardes
├── database\                    # Sauvegardes DB
├── files\                       # Sauvegardes fichiers
├── config\                      # Sauvegardes config
└── logs\                        # Logs de sauvegarde
```

---

## 🌐 Accès Réseau Local

### Adresses d'Accès
- **Interface principale**: `http://[IP-PC]:3001`
- **API Backend**: `http://[IP-PC]:5001/api`
- **Alternative avec nom**: `http://[NOM-PC].local:3001`

### Ports Utilisés
- **3001**: Interface utilisateur (React)
- **5001**: API Backend (Node.js)
- **5432**: Base de données PostgreSQL (local)

### Configuration Réseau
Les règles de pare-feu Windows sont automatiquement configurées pour :
- ✅ Autoriser les connexions entrantes sur les ports 3001 et 5001
- ✅ Activer la découverte réseau
- ✅ Permettre l'accès depuis le réseau local

---

## 🔄 Services et Automatisation

### Services Windows Configurés
- **ImprimerieService**: Service principal (démarrage automatique)
- **ImprimeriePlatformMonitor**: Surveillance (toutes les 5 minutes)
- **ImprimeriePlatformBackup**: Sauvegarde (quotidienne à 2h00)

### Surveillance Automatique
Le système vérifie automatiquement :
- ✅ Statut des processus PM2
- ✅ Accessibilité HTTP des services
- ✅ Redémarrage automatique en cas de problème
- ✅ Journalisation des événements

### Sauvegardes Automatiques
- **Fréquence**: Quotidienne à 2h00 du matin
- **Contenu**: Base de données + fichiers + configuration
- **Rétention**: 7 jours (configurable)
- **Emplacement**: `C:\Imprimerie-Backups\`

---

## 🛠️ Dépannage

### Problèmes Courants

#### ❌ La plateforme ne démarre pas
```powershell
# Vérifier les services
Get-Service -Name "*Imprimerie*"
pm2 status

# Redémarrer les services
Restart-Service -Name "ImprimerieService"
pm2 restart all
```

#### ❌ Pas d'accès réseau
```powershell
# Tester la connectivité
.\test-network-connectivity.ps1

# Vérifier le pare-feu
netsh advfirewall firewall show rule name="Imprimerie Frontend"
netsh advfirewall firewall show rule name="Imprimerie Backend"
```

#### ❌ Base de données inaccessible
```powershell
# Vérifier PostgreSQL
Get-Service -Name "postgresql*"
Start-Service -Name "postgresql*"

# Test de connexion
$env:PGPASSWORD = "imprimerie_password"
psql -U imprimerie_user -d imprimerie_db -h localhost -c "SELECT NOW();"
```

#### ❌ Sauvegarde échoue
```powershell
# Vérifier les tâches planifiées
Get-ScheduledTask -TaskName "*Imprimerie*"

# Test manuel
.\backup-complete.ps1

# Vérifier les logs
Get-Content "C:\Imprimerie-Backups\backup-complete.log" -Tail 20
```

### Logs Important
- **Services**: `C:\Imprimerie-Platform\logs\`
- **PM2**: `pm2 logs`
- **Sauvegardes**: `C:\Imprimerie-Backups\backup-complete.log`
- **Système**: Observateur d'événements Windows

---

## 📞 Support et Maintenance

### Commandes de Maintenance Régulière
```powershell
# Nettoyage des logs anciens (> 30 jours)
pm2 flush

# Vérification de l'état général
pm2 status && pm2 monit

# Mise à jour des processus PM2
pm2 save && pm2 resurrect
```

### Informations Système
```powershell
# État des services
Get-Service -Name "*Imprimerie*" | Format-Table

# Utilisation disque
Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, @{Name="Size(GB)";Expression={[math]::Round($_.Size/1GB,2)}}, @{Name="FreeSpace(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}}

# Processus actifs
pm2 jlist | ConvertFrom-Json | Select-Object name, pm2_env
```

---

## ✅ Checklist Post-Installation

### Tests Obligatoires
- [ ] Accès local : `http://localhost:3001` ✅
- [ ] Accès réseau depuis autre appareil ✅  
- [ ] Redémarrage PC → plateforme redémarre automatiquement ✅
- [ ] Service Windows "ImprimerieService" actif ✅
- [ ] Tâches planifiées créées ✅
- [ ] Première sauvegarde effectuée ✅

### Configuration Réseau Validée
- [ ] IP locale identifiée ✅
- [ ] Pare-feu configuré ✅
- [ ] Ports 3001 et 5001 accessibles ✅
- [ ] Découverte réseau activée ✅

### Sauvegardes Fonctionnelles
- [ ] Répertoire `C:\Imprimerie-Backups` créé ✅
- [ ] Scripts de sauvegarde testés ✅
- [ ] Tâche planifiée quotidienne active ✅
- [ ] Script de restauration disponible ✅

---

## 🎉 Félicitations !

Votre plateforme d'imprimerie numérique est maintenant :
- ✅ **Opérationnelle 24h/24** avec démarrage automatique
- ✅ **Accessible sur tout le réseau local**
- ✅ **Sauvegardée automatiquement** chaque jour
- ✅ **Surveillée et auto-réparatrice** en cas de problème
- ✅ **Prête pour la production**

### Accès Final
- **Interface**: `http://[IP-DE-VOTRE-PC]:3001`
- **Alternative**: `http://[NOM-DE-VOTRE-PC].local:3001`

La plateforme est maintenant prête à être utilisée par tous les appareils de votre réseau local !

---

*Guide créé pour la Plateforme d'Imprimerie Numérique - Version Windows*