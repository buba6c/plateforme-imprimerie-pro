# ===============================================
# Script de démarrage manuel de la plateforme
# Plateforme d'Imprimerie Numérique
# ===============================================

param(
    [string]$PlatformPath = "C:\Imprimerie-Platform",
    [switch]$Status,
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Logs
)

Write-Host "=== CONTRÔLE DE LA PLATEFORME D'IMPRIMERIE ===" -ForegroundColor Green

# Fonction pour obtenir l'adresse IP locale
function Get-LocalIP {
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -like "*Ethernet*" -or $_.InterfaceAlias -like "*Wi-Fi*"} | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*"}).IPAddress | Select-Object -First 1
    if (!$localIP) {
        $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}).IPAddress | Select-Object -First 1
    }
    return $localIP
}

if (!(Test-Path $PlatformPath)) {
    Write-Host "❌ Répertoire de la plateforme non trouvé: $PlatformPath" -ForegroundColor Red
    Write-Host "Utilisez d'abord setup-platform.ps1 pour installer la plateforme" -ForegroundColor Yellow
    exit 1
}

Set-Location $PlatformPath

if ($Status) {
    Write-Host "`n📊 STATUT DE LA PLATEFORME" -ForegroundColor Cyan
    
    # Vérifier le service Windows
    $service = Get-Service -Name "ImprimerieService" -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "Service Windows: $($service.Status)" -ForegroundColor $(if ($service.Status -eq "Running") { "Green" } else { "Red" })
    } else {
        Write-Host "Service Windows: Non configuré" -ForegroundColor Yellow
    }
    
    # Vérifier PM2
    try {
        $pm2Status = pm2 jlist | ConvertFrom-Json
        Write-Host "`nProcessus PM2:" -ForegroundColor Cyan
        foreach ($process in $pm2Status) {
            $color = if ($process.pm2_env.status -eq "online") { "Green" } else { "Red" }
            Write-Host "  - $($process.name): $($process.pm2_env.status)" -ForegroundColor $color
        }
    } catch {
        Write-Host "PM2: Non accessible" -ForegroundColor Red
    }
    
    # Test de connectivité
    Write-Host "`n🌐 CONNECTIVITÉ:" -ForegroundColor Cyan
    $localIP = Get-LocalIP
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 3 -UseBasicParsing
        Write-Host "  ✓ Frontend local: http://localhost:3001" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Frontend local: Inaccessible" -ForegroundColor Red
    }
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5001/api/health" -TimeoutSec 3 -UseBasicParsing
        Write-Host "  ✓ Backend local: http://localhost:5001" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Backend local: Inaccessible" -ForegroundColor Red
    }
    
    try {
        $response = Invoke-WebRequest -Uri "http://$localIP:3001" -TimeoutSec 3 -UseBasicParsing
        Write-Host "  ✓ Accès réseau: http://$localIP:3001" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Accès réseau: Non accessible depuis $localIP" -ForegroundColor Red
    }
    
    exit 0
}

if ($Stop) {
    Write-Host "`n⏹️ ARRÊT DE LA PLATEFORME" -ForegroundColor Yellow
    
    try {
        pm2 stop all
        Write-Host "✓ Processus PM2 arrêtés" -ForegroundColor Green
        
        $service = Get-Service -Name "ImprimerieService" -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq "Running") {
            Stop-Service -Name "ImprimerieService"
            Write-Host "✓ Service Windows arrêté" -ForegroundColor Green
        }
        
        Write-Host "✅ Plateforme arrêtée avec succès" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erreur lors de l'arrêt: $_" -ForegroundColor Red
    }
    
    exit 0
}

if ($Restart) {
    Write-Host "`n🔄 REDÉMARRAGE DE LA PLATEFORME" -ForegroundColor Cyan
    
    try {
        Write-Host "Arrêt des services..." -ForegroundColor Yellow
        pm2 stop all
        Start-Sleep -Seconds 3
        
        Write-Host "Redémarrage des services..." -ForegroundColor Yellow
        pm2 start ecosystem.config.js
        
        $service = Get-Service -Name "ImprimerieService" -ErrorAction SilentlyContinue
        if ($service) {
            Restart-Service -Name "ImprimerieService"
        }
        
        Write-Host "✅ Plateforme redémarrée avec succès" -ForegroundColor Green
        
        # Attendre et tester
        Start-Sleep -Seconds 10
        Write-Host "`nTest de connectivité..." -ForegroundColor Cyan
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 5 -UseBasicParsing
            Write-Host "✓ Frontend accessible" -ForegroundColor Green
        } catch {
            Write-Host "❌ Frontend non accessible" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Erreur lors du redémarrage: $_" -ForegroundColor Red
    }
    
    exit 0
}

if ($Logs) {
    Write-Host "`n📋 LOGS DE LA PLATEFORME" -ForegroundColor Cyan
    Write-Host "Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Yellow
    pm2 logs
    exit 0
}

# Démarrage par défaut
Write-Host "`n🚀 DÉMARRAGE DE LA PLATEFORME" -ForegroundColor Cyan

try {
    # Vérifier que les dépendances sont installées
    if (!(Get-Command pm2 -ErrorAction SilentlyContinue)) {
        Write-Host "❌ PM2 non installé. Utilisez install-dependencies.ps1 d'abord" -ForegroundColor Red
        exit 1
    }
    
    # Démarrer avec PM2
    Write-Host "Démarrage des processus PM2..." -ForegroundColor Yellow
    pm2 start ecosystem.config.js
    
    # Sauvegarder la configuration
    pm2 save
    
    # Démarrer le service Windows si configuré
    $service = Get-Service -Name "ImprimerieService" -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -ne "Running") {
            Start-Service -Name "ImprimerieService"
            Write-Host "✓ Service Windows démarré" -ForegroundColor Green
        } else {
            Write-Host "✓ Service Windows déjà en cours d'exécution" -ForegroundColor Green
        }
    } else {
        Write-Host "ℹ️ Service Windows non configuré (optionnel)" -ForegroundColor Cyan
    }
    
    Write-Host "✅ Plateforme démarrée avec succès" -ForegroundColor Green
    
    # Attendre et tester
    Write-Host "`nTest de démarrage..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    $localIP = Get-LocalIP
    $success = $true
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 5 -UseBasicParsing
        Write-Host "✓ Frontend disponible: http://localhost:3001" -ForegroundColor Green
    } catch {
        Write-Host "❌ Frontend non accessible localement" -ForegroundColor Red
        $success = $false
    }
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5001/api/health" -TimeoutSec 5 -UseBasicParsing
        Write-Host "✓ Backend disponible: http://localhost:5001" -ForegroundColor Green
    } catch {
        Write-Host "❌ Backend non accessible localement" -ForegroundColor Red
        $success = $false
    }
    
    if ($success) {
        Write-Host "`n🎉 PLATEFORME OPÉRATIONNELLE" -ForegroundColor Green
        Write-Host "Accès local: http://localhost:3001" -ForegroundColor Cyan
        Write-Host "Accès réseau: http://$localIP:3001" -ForegroundColor Cyan
        Write-Host "API Backend: http://$localIP:5001/api" -ForegroundColor Cyan
    } else {
        Write-Host "`n⚠️ La plateforme a démarré mais certains services ne répondent pas" -ForegroundColor Yellow
        Write-Host "Vérifiez les logs avec: pm2 logs" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Erreur lors du démarrage: $_" -ForegroundColor Red
    Write-Host "`nPour diagnostiquer:" -ForegroundColor Yellow
    Write-Host "1. Vérifiez que PostgreSQL fonctionne" -ForegroundColor White
    Write-Host "2. Vérifiez les logs: pm2 logs" -ForegroundColor White
    Write-Host "3. Testez la base de données avec test-platform.ps1" -ForegroundColor White
    exit 1
}

Write-Host "`n💡 Commandes utiles:" -ForegroundColor Yellow
Write-Host "  .\start-platform.ps1 -Status    # Vérifier le statut" -ForegroundColor White
Write-Host "  .\start-platform.ps1 -Stop      # Arrêter la plateforme" -ForegroundColor White
Write-Host "  .\start-platform.ps1 -Restart   # Redémarrer la plateforme" -ForegroundColor White
Write-Host "  .\start-platform.ps1 -Logs      # Voir les logs en temps réel" -ForegroundColor White