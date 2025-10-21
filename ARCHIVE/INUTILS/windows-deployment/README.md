# 🖥️ Installation Windows - Plateforme d'Imprimerie Numérique

## 🚀 Installation Rapide (Recommandé)

### Option 1: Installation Automatisée Complète
```powershell
# Ouvrez PowerShell en tant qu'Administrateur
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
cd "chemin\vers\windows-deployment"
.\install-all.ps1
```

✅ **Cette méthode unique configure tout automatiquement :**
- Installation des dépendances (Node.js, PostgreSQL, PM2)
- Configuration de la plateforme  
- Démarrage automatique au boot
- Accès réseau local
- Sauvegarde quotidienne automatique

---

## 🔧 Installation Manuelle (Étape par Étape)

### Prérequis
- Windows 10/11 (64-bit)
- Accès administrateur
- 8 GB RAM minimum
- 50 GB d'espace libre
- Connexion internet

### Étapes d'Installation

1. **Préparation**
   ```powershell
   # Ouvrez PowerShell en Administrateur
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
   cd "chemin\vers\windows-deployment"
   ```

2. **Installation des dépendances**
   ```powershell
   .\install-dependencies.ps1
   # ⚠️ REDÉMARRAGE REQUIS après cette étape
   ```

3. **Configuration de la plateforme** (après redémarrage)
   ```powershell
   .\setup-platform.ps1
   ```

4. **Démarrage automatique**
   ```powershell
   .\setup-startup.ps1
   ```

5. **Accès réseau local**
   ```powershell
   .\setup-network-access.ps1
   ```

6. **Sauvegardes automatiques**
   ```powershell
   .\setup-backup.ps1
   ```

---

## 🎯 Résultat Final

Une fois l'installation terminée, vous aurez :

### ✅ Plateforme Opérationnelle 24h/24
- Démarrage automatique avec Windows
- Redémarrage automatique en cas de crash
- Service Windows "ImprimerieService"

### ✅ Accès Réseau Local
- **Local**: `http://localhost:3001`
- **Réseau**: `http://[IP-PC]:3001` (ex: `http://192.168.1.100:3001`)
- Accessible depuis téléphones, tablettes, autres PC

### ✅ Sauvegardes Automatiques
- Quotidienne à 2h00 du matin
- Base de données + fichiers + configuration
- Rétention 7 jours (configurable)
- Scripts de restauration inclus

### ✅ Surveillance Continue
- Vérification toutes les 5 minutes
- Réparation automatique des problèmes
- Logs détaillés

---

## 📋 Scripts de Gestion

### Contrôle de la Plateforme
```powershell
cd "C:\Imprimerie-Platform"

# Vérifier le statut
.\start-platform.ps1 -Status

# Démarrer
.\start-platform.ps1

# Arrêter
.\start-platform.ps1 -Stop

# Redémarrer
.\start-platform.ps1 -Restart

# Voir les logs
.\start-platform.ps1 -Logs
```

### Gestion des Sauvegardes
```powershell
# Sauvegarde manuelle
.\backup-complete.ps1

# Lister les sauvegardes disponibles
.\restore-backup.ps1 -ListBackups

# Restaurer une sauvegarde
.\restore-backup.ps1 -BackupDate "2024-01-15_14-30-00"
```

### Tests et Diagnostics
```powershell
# Test de l'accès réseau
.\test-network-connectivity.ps1

# Surveillance temps réel
pm2 monit

# État des processus
pm2 status

# Logs des services
pm2 logs
```

---

## 🌐 Adresses d'Accès

| Service | Local | Réseau Local |
|---------|--------|-------------|
| **Interface Principale** | `http://localhost:3001` | `http://[IP-PC]:3001` |
| **API Backend** | `http://localhost:5001/api` | `http://[IP-PC]:5001/api` |
| **Alternative** | - | `http://[NOM-PC].local:3001` |

### Ports Utilisés
- **3001**: Interface utilisateur React
- **5001**: API Backend Node.js  
- **5432**: Base de données PostgreSQL

---

## 🛠️ Structure des Fichiers

```
C:\Imprimerie-Platform\          # Installation principale
├── backend\                     # Serveur Node.js
├── frontend\                    # Interface React
├── uploads\                     # Fichiers uploadés
├── logs\                        # Journaux
├── ecosystem.config.js          # Configuration PM2
├── .env                         # Variables d'environnement
├── backup-complete.ps1          # Script sauvegarde
├── restore-backup.ps1           # Script restauration
├── monitor-platform.ps1        # Script surveillance
├── start-platform.bat          # Démarrage manuel
└── stop-platform.bat           # Arrêt manuel

C:\Imprimerie-Backups\           # Sauvegardes
├── database\                    # Sauvegardes PostgreSQL
├── files\                       # Fichiers uploadés  
├── config\                      # Configuration
└── logs\                        # Logs de sauvegarde
```

---

## 🚨 Dépannage Rapide

### ❌ La plateforme ne démarre pas
```powershell
# Vérifier les services
Get-Service -Name "*Imprimerie*"
pm2 status

# Redémarrer
Restart-Service -Name "ImprimerieService"
pm2 restart all
```

### ❌ Pas d'accès réseau
```powershell
# Tester la connectivité
.\test-network-connectivity.ps1

# Vérifier le pare-feu
netsh advfirewall firewall show rule name="Imprimerie Frontend"
```

### ❌ Base de données inaccessible
```powershell
# Vérifier PostgreSQL
Get-Service -Name "postgresql*"
Start-Service -Name "postgresql*"

# Test de connexion
$env:PGPASSWORD = "imprimerie_password"
psql -U imprimerie_user -d imprimerie_db -h localhost -c "SELECT NOW();"
```

---

## 📞 Support

### Logs Importants
- **Services**: `C:\Imprimerie-Platform\logs\`
- **PM2**: `pm2 logs`
- **Sauvegardes**: `C:\Imprimerie-Backups\backup-complete.log`
- **Système**: Observateur d'événements Windows

### Commandes de Diagnostic
```powershell
# État général
pm2 status && Get-Service -Name "*Imprimerie*"

# Utilisation disque
Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, @{Name="FreeSpace(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}}

# Processus actifs
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*PM2*"}
```

---

## ✅ Checklist Post-Installation

### Tests Obligatoires
- [ ] Accès local: `http://localhost:3001` ✅
- [ ] Accès réseau depuis autre appareil ✅
- [ ] Redémarrage PC → plateforme redémarre automatiquement ✅
- [ ] Service "ImprimerieService" actif ✅
- [ ] Première sauvegarde effectuée ✅

### Configuration Validée
- [ ] IP locale identifiée ✅
- [ ] Pare-feu configuré ✅
- [ ] Ports 3001 et 5001 accessibles ✅
- [ ] Découverte réseau activée ✅
- [ ] Tâches planifiées créées ✅

---

## 🎉 Félicitations !

Votre plateforme d'imprimerie numérique est maintenant :
- ✅ **Opérationnelle 24h/24** avec démarrage automatique
- ✅ **Accessible sur tout le réseau local**  
- ✅ **Sauvegardée automatiquement** chaque jour
- ✅ **Surveillée et auto-réparatrice** en cas de problème
- ✅ **Prête pour la production**

### 🌟 Accès Final
**Interface**: `http://[IP-DE-VOTRE-PC]:3001`

La plateforme est prête à être utilisée par tous les appareils de votre réseau local !

---

*Guide créé pour la Plateforme d'Imprimerie Numérique - Version Windows*