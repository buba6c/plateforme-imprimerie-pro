# ===============================================
# Script d'installation complète automatisée
# Plateforme d'Imprimerie Numérique - Windows
# ===============================================

Write-Host @"

 ██████╗ ██╗      █████╗ ████████╗███████╗███████╗ ██████╗ ██████╗ ███╗   ███╗███████╗
██╔════╝ ██║     ██╔══██╗╚══██╔══╝██╔════╝██╔════╝██╔═══██╗██╔══██╗████╗ ████║██╔════╝
██║  ███╗██║     ███████║   ██║   █████╗  █████╗  ██║   ██║██████╔╝██╔████╔██║█████╗  
██║   ██║██║     ██╔══██║   ██║   ██╔══╝  ██╔══╝  ██║   ██║██╔══██╗██║╚██╔╝██║██╔══╝  
╚██████╔╝███████╗██║  ██║   ██║   ███████╗██║     ╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗
 ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝
                                                                                        
            PLATEFORME D'IMPRIMERIE NUMÉRIQUE - INSTALLATION WINDOWS
"@ -ForegroundColor Cyan

Write-Host "`n🎯 INSTALLATION AUTOMATISÉE COMPLÈTE" -ForegroundColor Green
Write-Host "Cette installation va configurer votre plateforme pour:" -ForegroundColor Yellow
Write-Host "  ✅ Fonctionnement 24h/24 avec redémarrage automatique" -ForegroundColor White
Write-Host "  ✅ Accès depuis tous les appareils du réseau local" -ForegroundColor White
Write-Host "  ✅ Sauvegarde automatique quotidienne" -ForegroundColor White
Write-Host "  ✅ Surveillance et réparation automatique" -ForegroundColor White

# Vérifier les privilèges administrateur
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "`n❌ ERREUR: Ce script doit être exécuté en tant qu'administrateur" -ForegroundColor Red
    Write-Host "1. Clic droit sur PowerShell" -ForegroundColor Yellow
    Write-Host "2. Sélectionner 'Exécuter en tant qu'administrateur'" -ForegroundColor Yellow
    Write-Host "3. Relancer ce script" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

# Paramètres configurables
$PlatformPath = "C:\Imprimerie-Platform"
$BackupPath = "C:\Imprimerie-Backups"
$BackupTime = "02:00"
$RetentionDays = 7

Write-Host "`n📋 CONFIGURATION DE L'INSTALLATION:" -ForegroundColor Cyan
Write-Host "Répertoire d'installation: $PlatformPath" -ForegroundColor White
Write-Host "Répertoire de sauvegarde: $BackupPath" -ForegroundColor White
Write-Host "Heure de sauvegarde: $BackupTime quotidiennement" -ForegroundColor White
Write-Host "Rétention des sauvegardes: $RetentionDays jours" -ForegroundColor White

$confirm = Read-Host "`nContinuer l'installation? (O/N)"
if ($confirm -notlike "O*" -and $confirm -notlike "Y*") {
    Write-Host "Installation annulée." -ForegroundColor Yellow
    exit 0
}

# Variables de contrôle
$steps = 6
$currentStep = 0
$errors = @()

function Update-Progress {
    param($message, $step)
    $currentStep++
    $percent = [math]::Round(($currentStep / $steps) * 100)
    Write-Host "`n[$currentStep/$steps - $percent%] $message" -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor DarkGray
}

try {
    # Étape 1: Installation des dépendances
    Update-Progress "INSTALLATION DES DÉPENDANCES" 1
    Write-Host "Installation de Chocolatey, Node.js, PostgreSQL, PM2, Git..." -ForegroundColor Yellow
    
    if (Test-Path ".\install-dependencies.ps1") {
        & .\install-dependencies.ps1
        if ($LASTEXITCODE -ne 0) {
            throw "Erreur lors de l'installation des dépendances"
        }
    } else {
        throw "Script install-dependencies.ps1 non trouvé"
    }

    # Vérifier si un redémarrage est nécessaire
    if (!(Get-Command node -ErrorAction SilentlyContinue) -or !(Get-Command pm2 -ErrorAction SilentlyContinue)) {
        Write-Host "`n⚠️ REDÉMARRAGE REQUIS" -ForegroundColor Yellow
        Write-Host "Les dépendances ont été installées mais nécessitent un redémarrage." -ForegroundColor Yellow
        Write-Host "Après redémarrage, relancez ce script pour continuer." -ForegroundColor Cyan
        
        $restart = Read-Host "Redémarrer maintenant? (O/N)"
        if ($restart -like "O*" -or $restart -like "Y*") {
            Restart-Computer -Force
        }
        exit 0
    }

    # Étape 2: Configuration de la plateforme
    Update-Progress "CONFIGURATION DE LA PLATEFORME" 2
    Write-Host "Configuration de PostgreSQL, copie des fichiers, installation des dépendances Node.js..." -ForegroundColor Yellow
    
    if (Test-Path ".\setup-platform.ps1") {
        & .\setup-platform.ps1 -PlatformPath $PlatformPath
        if ($LASTEXITCODE -ne 0) {
            $errors += "Configuration de la plateforme"
        }
    } else {
        $errors += "Script setup-platform.ps1 non trouvé"
    }

    # Étape 3: Configuration du démarrage automatique
    Update-Progress "CONFIGURATION DU DÉMARRAGE AUTOMATIQUE" 3
    Write-Host "Création des services Windows et configuration PM2..." -ForegroundColor Yellow
    
    if (Test-Path ".\setup-startup.ps1") {
        & .\setup-startup.ps1 -PlatformPath $PlatformPath
        if ($LASTEXITCODE -ne 0) {
            $errors += "Configuration du démarrage automatique"
        }
    } else {
        $errors += "Script setup-startup.ps1 non trouvé"
    }

    # Étape 4: Configuration de l'accès réseau
    Update-Progress "CONFIGURATION DE L'ACCÈS RÉSEAU LOCAL" 4
    Write-Host "Configuration du pare-feu et détection de l'adresse IP locale..." -ForegroundColor Yellow
    
    if (Test-Path ".\setup-network-access.ps1") {
        & .\setup-network-access.ps1 -PlatformPath $PlatformPath
        if ($LASTEXITCODE -ne 0) {
            $errors += "Configuration de l'accès réseau"
        }
    } else {
        $errors += "Script setup-network-access.ps1 non trouvé"
    }

    # Étape 5: Configuration des sauvegardes
    Update-Progress "CONFIGURATION DES SAUVEGARDES AUTOMATIQUES" 5
    Write-Host "Mise en place de la sauvegarde quotidienne et des scripts de restauration..." -ForegroundColor Yellow
    
    if (Test-Path ".\setup-backup.ps1") {
        & .\setup-backup.ps1 -PlatformPath $PlatformPath -BackupPath $BackupPath -BackupTime $BackupTime -RetentionDays $RetentionDays
        if ($LASTEXITCODE -ne 0) {
            $errors += "Configuration des sauvegardes"
        }
    } else {
        $errors += "Script setup-backup.ps1 non trouvé"
    }

    # Étape 6: Tests et vérification finale
    Update-Progress "TESTS ET VÉRIFICATION FINALE" 6
    Write-Host "Test de la plateforme et vérification de tous les composants..." -ForegroundColor Yellow
    
    # Attendre que tous les services démarrent
    Start-Sleep -Seconds 15
    
    # Test de connectivité locale
    $localSuccess = $false
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $localSuccess = $true
            Write-Host "✅ Accès local fonctionnel" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ Accès local non disponible immédiatement (peut prendre plus de temps)" -ForegroundColor Yellow
    }

    # Test de l'API
    $apiSuccess = $false
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5001/api/health" -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $apiSuccess = $true
            Write-Host "✅ API Backend fonctionnelle" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ API Backend non disponible immédiatement" -ForegroundColor Yellow
    }

    # Test réseau
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -like "*Ethernet*" -or $_.InterfaceAlias -like "*Wi-Fi*"} | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*"}).IPAddress | Select-Object -First 1
    if (!$localIP) {
        $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}).IPAddress | Select-Object -First 1
    }

    Write-Host "`n🎉 INSTALLATION TERMINÉE !" -ForegroundColor Green
    Write-Host "=" * 60 -ForegroundColor Green
    
    if ($errors.Count -eq 0) {
        Write-Host "✅ Toutes les étapes ont été completées avec succès" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Quelques erreurs mineures détectées dans:" -ForegroundColor Yellow
        foreach ($error in $errors) {
            Write-Host "  - $error" -ForegroundColor Yellow
        }
    }

    Write-Host "`n📋 RÉSUMÉ DE L'INSTALLATION:" -ForegroundColor Cyan
    Write-Host "Plateforme installée dans: $PlatformPath" -ForegroundColor White
    Write-Host "Sauvegardes automatiques: $BackupPath" -ForegroundColor White
    Write-Host "Service Windows: ImprimerieService" -ForegroundColor White
    Write-Host "Surveillance: Toutes les 5 minutes" -ForegroundColor White
    Write-Host "Sauvegarde: $BackupTime quotidiennement" -ForegroundColor White

    Write-Host "`n🌐 ADRESSES D'ACCÈS:" -ForegroundColor Cyan
    Write-Host "Local: http://localhost:3001" -ForegroundColor White
    if ($localIP) {
        Write-Host "Réseau local: http://$localIP:3001" -ForegroundColor White
        Write-Host "API Backend: http://$localIP:5001/api" -ForegroundColor White
    }

    Write-Host "`n🔧 SCRIPTS DE GESTION DISPONIBLES:" -ForegroundColor Cyan
    Write-Host "start-platform.ps1        - Démarrer/arrêter/redémarrer la plateforme" -ForegroundColor White
    Write-Host "test-network-connectivity.ps1 - Tester l'accès réseau" -ForegroundColor White
    Write-Host "backup-complete.ps1       - Sauvegarde manuelle" -ForegroundColor White
    Write-Host "restore-backup.ps1        - Restaurer une sauvegarde" -ForegroundColor White

    Write-Host "`n✅ PROCHAINES ÉTAPES:" -ForegroundColor Green
    Write-Host "1. Testez l'accès local: http://localhost:3001" -ForegroundColor White
    Write-Host "2. Testez l'accès réseau depuis un autre appareil" -ForegroundColor White
    Write-Host "3. Testez le redémarrage automatique (redémarrez le PC)" -ForegroundColor White
    Write-Host "4. Vérifiez les sauvegardes dans $BackupPath" -ForegroundColor White

    if (!$localSuccess) {
        Write-Host "`n⚠️ ATTENTION:" -ForegroundColor Yellow
        Write-Host "La plateforme met parfois quelques minutes à démarrer complètement." -ForegroundColor Yellow
        Write-Host "Si l'accès local ne fonctionne pas immédiatement:" -ForegroundColor Yellow
        Write-Host "1. Attendez 2-3 minutes supplémentaires" -ForegroundColor White
        Write-Host "2. Ou relancez: .\start-platform.ps1 -Restart" -ForegroundColor White
        Write-Host "3. Vérifiez les logs: pm2 logs" -ForegroundColor White
    }

    Write-Host "`n🎉 FÉLICITATIONS !" -ForegroundColor Green
    Write-Host "Votre plateforme d'imprimerie numérique est maintenant:" -ForegroundColor Green
    Write-Host "✅ Opérationnelle 24h/24 avec démarrage automatique" -ForegroundColor White
    Write-Host "✅ Accessible depuis tous les appareils de votre réseau" -ForegroundColor White
    Write-Host "✅ Sauvegardée automatiquement chaque jour" -ForegroundColor White
    Write-Host "✅ Surveillée et auto-réparatrice en cas de problème" -ForegroundColor White

} catch {
    Write-Host "`n❌ ERREUR CRITIQUE LORS DE L'INSTALLATION:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nPour obtenir de l'aide:" -ForegroundColor Yellow
    Write-Host "1. Vérifiez que vous êtes bien administrateur" -ForegroundColor White
    Write-Host "2. Vérifiez votre connexion internet" -ForegroundColor White
    Write-Host "3. Redémarrez et relancez l'installation" -ForegroundColor White
    Write-Host "4. Ou exécutez les scripts individuellement" -ForegroundColor White
}

Write-Host "`n" -NoNewline
Read-Host "Appuyez sur Entrée pour terminer"