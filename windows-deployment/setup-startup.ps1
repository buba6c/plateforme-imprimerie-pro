# ===============================================
# Script de configuration du démarrage automatique
# Plateforme d'Imprimerie Numérique
# ===============================================

param(
    [string]$PlatformPath = "C:\Imprimerie-Platform"
)

Write-Host "=== CONFIGURATION DU DÉMARRAGE AUTOMATIQUE ===" -ForegroundColor Green

# Vérifier les privilèges administrateur
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERREUR: Ce script doit être exécuté en tant qu'administrateur" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "`n1. Configuration de PM2 pour le démarrage automatique..." -ForegroundColor Cyan
    Set-Location $PlatformPath
    
    # Sauvegarder la configuration PM2
    pm2 start ecosystem.config.js
    pm2 save
    
    # Configurer le démarrage automatique de PM2
    pm2 startup
    pm2 save

    Write-Host "`n2. Création d'un service Windows pour la plateforme..." -ForegroundColor Cyan
    
    # Créer un script batch pour démarrer la plateforme
    @"
@echo off
cd /d $PlatformPath
pm2 resurrect
pm2 start ecosystem.config.js
echo Plateforme d'imprimerie démarrée
"@ | Out-File -FilePath "$PlatformPath\start-platform.bat" -Encoding ASCII

    # Créer un script batch pour arrêter la plateforme
    @"
@echo off
cd /d $PlatformPath
pm2 stop all
echo Plateforme d'imprimerie arrêtée
"@ | Out-File -FilePath "$PlatformPath\stop-platform.bat" -Encoding ASCII

    Write-Host "`n3. Configuration du service Windows avec NSSM..." -ForegroundColor Cyan
    
    # Installer NSSM (Non-Sucking Service Manager) pour créer un service Windows robuste
    if (!(Get-Command nssm -ErrorAction SilentlyContinue)) {
        Write-Host "Installation de NSSM..." -ForegroundColor Yellow
        choco install nssm -y
        refreshenv
    }

    # Supprimer le service s'il existe déjà
    $serviceName = "ImprimerieService"
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host "Suppression de l'ancien service..." -ForegroundColor Yellow
        nssm stop $serviceName
        nssm remove $serviceName confirm
    }

    # Créer le nouveau service
    Write-Host "Création du service Windows..." -ForegroundColor Yellow
    nssm install $serviceName "$PlatformPath\start-platform.bat"
    nssm set $serviceName DisplayName "Plateforme d'Imprimerie Numérique"
    nssm set $serviceName Description "Service automatique pour la plateforme d'imprimerie avec redémarrage en cas de panne"
    nssm set $serviceName Start SERVICE_AUTO_START
    nssm set $serviceName AppStdout "$PlatformPath\logs\service-out.log"
    nssm set $serviceName AppStderr "$PlatformPath\logs\service-error.log"
    nssm set $serviceName AppRotateFiles 1
    nssm set $serviceName AppRotateOnline 1
    nssm set $serviceName AppRotateBytes 10485760  # 10MB
    
    # Configuration du redémarrage automatique
    nssm set $serviceName AppThrottle 1500  # Attendre 1.5s avant de redémarrer
    nssm set $serviceName AppExit Default Restart
    nssm set $serviceName AppRestartDelay 5000  # 5 secondes de délai

    Write-Host "`n4. Création d'une tâche planifiée de surveillance..." -ForegroundColor Cyan
    
    # Créer un script de surveillance qui vérifie que les services tournent
    @"
# Script de surveillance de la plateforme
`$platformPath = "$PlatformPath"
`$logFile = "`$platformPath\logs\monitor.log"

function Write-Log(`$message) {
    `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "`$timestamp - `$message" | Out-File -FilePath `$logFile -Append -Encoding UTF8
}

try {
    Set-Location `$platformPath
    
    # Vérifier que PM2 tourne
    `$pm2Status = pm2 jlist | ConvertFrom-Json
    `$backendRunning = `$pm2Status | Where-Object { `$_.name -eq 'imprimerie-backend' -and `$_.pm2_env.status -eq 'online' }
    `$frontendRunning = `$pm2Status | Where-Object { `$_.name -eq 'imprimerie-frontend' -and `$_.pm2_env.status -eq 'online' }
    
    if (!`$backendRunning) {
        Write-Log "Backend non détecté, redémarrage..."
        pm2 restart imprimerie-backend
    }
    
    if (!`$frontendRunning) {
        Write-Log "Frontend non détecté, redémarrage..."
        pm2 restart imprimerie-frontend
    }
    
    # Vérifier la connectivité HTTP
    try {
        `$response = Invoke-WebRequest -Uri "http://localhost:5001/api/health" -TimeoutSec 10 -UseBasicParsing
        if (`$response.StatusCode -ne 200) {
            Write-Log "API non accessible, redémarrage du backend..."
            pm2 restart imprimerie-backend
        }
    } catch {
        Write-Log "Erreur d'accès à l'API: `$_"
        pm2 restart imprimerie-backend
    }
    
    try {
        `$response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 10 -UseBasicParsing
        if (`$response.StatusCode -ne 200) {
            Write-Log "Frontend non accessible, redémarrage..."
            pm2 restart imprimerie-frontend
        }
    } catch {
        Write-Log "Erreur d'accès au frontend: `$_"
        pm2 restart imprimerie-frontend
    }
    
    Write-Log "Surveillance terminée - Tout fonctionne"
    
} catch {
    Write-Log "Erreur de surveillance: `$_"
}
"@ | Out-File -FilePath "$PlatformPath\monitor-platform.ps1" -Encoding UTF8

    # Créer la tâche planifiée pour surveiller toutes les 5 minutes
    $taskName = "ImprimeriePlatformMonitor"
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$PlatformPath\monitor-platform.ps1`""
    $trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue) -At (Get-Date)
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Surveille et redémarre automatiquement la plateforme d'imprimerie si nécessaire"

    Write-Host "`n5. Démarrage du service..." -ForegroundColor Cyan
    Start-Service -Name $serviceName
    
    Write-Host "`n6. Vérification du statut..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10
    
    $service = Get-Service -Name $serviceName
    if ($service.Status -eq "Running") {
        Write-Host "✓ Service Windows démarré avec succès" -ForegroundColor Green
    } else {
        Write-Host "⚠ Problème avec le service Windows" -ForegroundColor Yellow
    }
    
    # Vérifier PM2
    $pm2Status = pm2 jlist | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($pm2Status -and $pm2Status.Count -gt 0) {
        Write-Host "✓ PM2 fonctionne avec $($pm2Status.Count) processus" -ForegroundColor Green
    } else {
        Write-Host "⚠ PM2 n'a pas démarré correctement" -ForegroundColor Yellow
    }

    Write-Host "`n=== DÉMARRAGE AUTOMATIQUE CONFIGURÉ ===" -ForegroundColor Green
    Write-Host "Service Windows: $serviceName" -ForegroundColor Cyan
    Write-Host "Surveillance: Toutes les 5 minutes" -ForegroundColor Cyan
    Write-Host "Logs: $PlatformPath\logs\" -ForegroundColor Cyan
    Write-Host "`nLa plateforme démarrera automatiquement au démarrage de Windows" -ForegroundColor Yellow
    Write-Host "et se redémarrera automatiquement en cas de problème." -ForegroundColor Yellow

} catch {
    Write-Host "`nERREUR lors de la configuration: $_" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

Read-Host "`nAppuyez sur Entrée pour continuer"