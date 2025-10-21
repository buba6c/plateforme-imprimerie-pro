# ===============================================
# Script de test complet de l'installation Windows
# Plateforme d'Imprimerie Numérique
# ===============================================

param(
    [string]$PlatformPath = "C:\Imprimerie-Platform",
    [string]$BackupPath = "C:\Imprimerie-Backups",
    [switch]$Detailed
)

Write-Host @"

 ████████╗███████╗███████╗████████╗    ██████╗ ██████╗ ███╗   ███╗██████╗ ██╗     ███████╗████████╗
╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝   ██╔════╝██╔═══██╗████╗ ████║██╔══██╗██║     ██╔════╝╚══██╔══╝
   ██║   █████╗  ███████╗   ██║      ██║     ██║   ██║██╔████╔██║██████╔╝██║     █████╗     ██║   
   ██║   ██╔══╝  ╚════██║   ██║      ██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██║     ██╔══╝     ██║   
   ██║   ███████╗███████║   ██║      ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ███████╗███████╗   ██║   
   ╚═╝   ╚══════╝╚══════╝   ╚═╝       ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚══════╝╚══════╝   ╚═╝   
                                                                                                   
           VÉRIFICATION COMPLÈTE DE L'INSTALLATION WINDOWS
"@ -ForegroundColor Cyan

Write-Host "`n🔍 LANCEMENT DES TESTS DE VALIDATION" -ForegroundColor Green

$results = @{
    Dependencies = @{}
    Platform = @{}
    Services = @{}
    Network = @{}
    Backup = @{}
    Overall = @{
        TotalTests = 0
        Passed = 0
        Failed = 0
        Warnings = 0
    }
}

function Test-Component {
    param(
        [string]$TestName,
        [scriptblock]$TestScript,
        [string]$Category = "General"
    )
    
    $results.Overall.TotalTests++
    Write-Host "`n🔎 Test: $TestName" -ForegroundColor Yellow
    
    try {
        $result = & $TestScript
        if ($result.Status -eq "Success") {
            Write-Host "  ✅ $($result.Message)" -ForegroundColor Green
            $results.Overall.Passed++
            $results[$Category][$TestName] = @{ Status = "Success"; Message = $result.Message }
        } elseif ($result.Status -eq "Warning") {
            Write-Host "  ⚠️  $($result.Message)" -ForegroundColor Yellow
            $results.Overall.Warnings++
            $results[$Category][$TestName] = @{ Status = "Warning"; Message = $result.Message }
        } else {
            Write-Host "  ❌ $($result.Message)" -ForegroundColor Red
            $results.Overall.Failed++
            $results[$Category][$TestName] = @{ Status = "Failed"; Message = $result.Message }
        }
        
        if ($Detailed -and $result.Details) {
            Write-Host "     $($result.Details)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
        $results.Overall.Failed++
        $results[$Category][$TestName] = @{ Status = "Failed"; Message = $_.Exception.Message }
    }
}

# Tests des dépendances
Write-Host "`n═══ 1. VÉRIFICATION DES DÉPENDANCES ═══" -ForegroundColor Cyan

Test-Component "Node.js installé" {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $version = node --version
        return @{ Status = "Success"; Message = "Node.js $version installé"; Details = $version }
    } else {
        return @{ Status = "Failed"; Message = "Node.js non trouvé" }
    }
} -Category "Dependencies"

Test-Component "PM2 installé" {
    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        $version = pm2 --version
        return @{ Status = "Success"; Message = "PM2 v$version installé"; Details = $version }
    } else {
        return @{ Status = "Failed"; Message = "PM2 non trouvé" }
    }
} -Category "Dependencies"

Test-Component "PostgreSQL installé" {
    $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    if ($service) {
        $status = $service.Status
        if ($status -eq "Running") {
            return @{ Status = "Success"; Message = "PostgreSQL en cours d'exécution"; Details = "Service: $($service.Name)" }
        } else {
            return @{ Status = "Warning"; Message = "PostgreSQL installé mais arrêté"; Details = "Status: $status" }
        }
    } else {
        return @{ Status = "Failed"; Message = "PostgreSQL non trouvé" }
    }
} -Category "Dependencies"

Test-Component "Git installé" {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $version = git --version
        return @{ Status = "Success"; Message = "Git installé"; Details = $version }
    } else {
        return @{ Status = "Warning"; Message = "Git non trouvé (optionnel)" }
    }
} -Category "Dependencies"

# Tests de la plateforme
Write-Host "`n═══ 2. VÉRIFICATION DE LA PLATEFORME ═══" -ForegroundColor Cyan

Test-Component "Répertoire de la plateforme" {
    if (Test-Path $PlatformPath) {
        $items = Get-ChildItem $PlatformPath
        return @{ Status = "Success"; Message = "Plateforme installée dans $PlatformPath"; Details = "$($items.Count) éléments trouvés" }
    } else {
        return @{ Status = "Failed"; Message = "Répertoire de plateforme non trouvé: $PlatformPath" }
    }
} -Category "Platform"

Test-Component "Configuration .env" {
    $envFile = Join-Path $PlatformPath ".env"
    if (Test-Path $envFile) {
        $content = Get-Content $envFile -Raw
        if ($content -like "*DB_*" -and $content -like "*JWT_*") {
            return @{ Status = "Success"; Message = "Fichier .env configuré correctement" }
        } else {
            return @{ Status = "Warning"; Message = "Fichier .env incomplet" }
        }
    } else {
        return @{ Status = "Failed"; Message = "Fichier .env manquant" }
    }
} -Category "Platform"

Test-Component "Configuration PM2" {
    $ecosystemFile = Join-Path $PlatformPath "ecosystem.config.js"
    if (Test-Path $ecosystemFile) {
        $content = Get-Content $ecosystemFile -Raw
        if ($content -like "*imprimerie-backend*" -and $content -like "*imprimerie-frontend*") {
            return @{ Status = "Success"; Message = "Configuration PM2 correcte" }
        } else {
            return @{ Status = "Warning"; Message = "Configuration PM2 incomplète" }
        }
    } else {
        return @{ Status = "Failed"; Message = "Configuration PM2 manquante" }
    }
} -Category "Platform"

Test-Component "Dépendances backend installées" {
    $backendPath = Join-Path $PlatformPath "backend"
    $nodeModules = Join-Path $backendPath "node_modules"
    if (Test-Path $nodeModules) {
        $packages = Get-ChildItem $nodeModules | Measure-Object
        return @{ Status = "Success"; Message = "Dépendances backend installées"; Details = "$($packages.Count) packages" }
    } else {
        return @{ Status = "Failed"; Message = "Dépendances backend manquantes" }
    }
} -Category "Platform"

Test-Component "Dépendances frontend installées" {
    $frontendPath = Join-Path $PlatformPath "frontend"
    $nodeModules = Join-Path $frontendPath "node_modules"
    if (Test-Path $nodeModules) {
        $packages = Get-ChildItem $nodeModules | Measure-Object
        return @{ Status = "Success"; Message = "Dépendances frontend installées"; Details = "$($packages.Count) packages" }
    } else {
        return @{ Status = "Failed"; Message = "Dépendances frontend manquantes" }
    }
} -Category "Platform"

# Tests des services
Write-Host "`n═══ 3. VÉRIFICATION DES SERVICES ═══" -ForegroundColor Cyan

Test-Component "Service Windows principal" {
    $service = Get-Service -Name "ImprimerieService" -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -eq "Running") {
            return @{ Status = "Success"; Message = "Service Windows actif"; Details = "Status: $($service.Status)" }
        } else {
            return @{ Status = "Warning"; Message = "Service Windows configuré mais arrêté"; Details = "Status: $($service.Status)" }
        }
    } else {
        return @{ Status = "Failed"; Message = "Service Windows non configuré" }
    }
} -Category "Services"

Test-Component "Processus PM2" {
    Set-Location $PlatformPath
    try {
        $pm2List = pm2 jlist | ConvertFrom-Json
        $backend = $pm2List | Where-Object { $_.name -eq "imprimerie-backend" }
        $frontend = $pm2List | Where-Object { $_.name -eq "imprimerie-frontend" }
        
        if ($backend -and $frontend) {
            $backendStatus = $backend.pm2_env.status
            $frontendStatus = $frontend.pm2_env.status
            
            if ($backendStatus -eq "online" -and $frontendStatus -eq "online") {
                return @{ Status = "Success"; Message = "Tous les processus PM2 en ligne"; Details = "Backend: $backendStatus, Frontend: $frontendStatus" }
            } elseif ($backendStatus -eq "online" -or $frontendStatus -eq "online") {
                return @{ Status = "Warning"; Message = "Certains processus PM2 hors ligne"; Details = "Backend: $backendStatus, Frontend: $frontendStatus" }
            } else {
                return @{ Status = "Failed"; Message = "Aucun processus PM2 en ligne"; Details = "Backend: $backendStatus, Frontend: $frontendStatus" }
            }
        } else {
            return @{ Status = "Failed"; Message = "Processus PM2 non configurés" }
        }
    } catch {
        return @{ Status = "Failed"; Message = "Impossible d'accéder à PM2" }
    }
} -Category "Services"

Test-Component "Tâches planifiées" {
    $monitorTask = Get-ScheduledTask -TaskName "ImprimeriePlatformMonitor" -ErrorAction SilentlyContinue
    $backupTask = Get-ScheduledTask -TaskName "ImprimeriePlatformBackup" -ErrorAction SilentlyContinue
    
    $count = 0
    if ($monitorTask) { $count++ }
    if ($backupTask) { $count++ }
    
    if ($count -eq 2) {
        return @{ Status = "Success"; Message = "Toutes les tâches planifiées configurées"; Details = "Surveillance et sauvegarde" }
    } elseif ($count -eq 1) {
        return @{ Status = "Warning"; Message = "Certaines tâches planifiées manquantes"; Details = "$count/2 configurées" }
    } else {
        return @{ Status = "Failed"; Message = "Aucune tâche planifiée configurée" }
    }
} -Category "Services"

# Tests réseau
Write-Host "`n═══ 4. VÉRIFICATION DU RÉSEAU ═══" -ForegroundColor Cyan

Test-Component "Connectivité locale backend" {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5001/api/health" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            return @{ Status = "Success"; Message = "Backend accessible localement"; Details = "Port 5001 OK" }
        } else {
            return @{ Status = "Warning"; Message = "Backend répond avec erreur: $($response.StatusCode)" }
        }
    } catch {
        return @{ Status = "Failed"; Message = "Backend non accessible localement" }
    }
} -Category "Network"

Test-Component "Connectivité locale frontend" {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            return @{ Status = "Success"; Message = "Frontend accessible localement"; Details = "Port 3001 OK" }
        } else {
            return @{ Status = "Warning"; Message = "Frontend répond avec erreur: $($response.StatusCode)" }
        }
    } catch {
        return @{ Status = "Failed"; Message = "Frontend non accessible localement" }
    }
} -Category "Network"

Test-Component "Configuration pare-feu" {
    $backendRule = netsh advfirewall firewall show rule name="Imprimerie Backend" 2>$null
    $frontendRule = netsh advfirewall firewall show rule name="Imprimerie Frontend" 2>$null
    
    if ($backendRule -and $frontendRule) {
        return @{ Status = "Success"; Message = "Règles de pare-feu configurées"; Details = "Backend et Frontend autorisés" }
    } elseif ($backendRule -or $frontendRule) {
        return @{ Status = "Warning"; Message = "Certaines règles de pare-feu manquantes" }
    } else {
        return @{ Status = "Failed"; Message = "Aucune règle de pare-feu configurée" }
    }
} -Category "Network"

Test-Component "Adresse IP locale" {
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -like "*Ethernet*" -or $_.InterfaceAlias -like "*Wi-Fi*"} | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*"}).IPAddress | Select-Object -First 1
    
    if ($localIP) {
        # Test d'accès réseau si possible
        try {
            $response = Invoke-WebRequest -Uri "http://$localIP:3001" -TimeoutSec 3 -UseBasicParsing
            return @{ Status = "Success"; Message = "Accès réseau fonctionnel"; Details = "IP: $localIP" }
        } catch {
            return @{ Status = "Warning"; Message = "IP détectée mais accès réseau non testé"; Details = "IP: $localIP" }
        }
    } else {
        return @{ Status = "Failed"; Message = "Adresse IP locale non détectée" }
    }
} -Category "Network"

# Tests de sauvegarde
Write-Host "`n═══ 5. VÉRIFICATION DES SAUVEGARDES ═══" -ForegroundColor Cyan

Test-Component "Répertoire de sauvegarde" {
    if (Test-Path $BackupPath) {
        $subDirs = @("database", "files", "config", "logs") | Where-Object { Test-Path (Join-Path $BackupPath $_) }
        return @{ Status = "Success"; Message = "Répertoire de sauvegarde configuré"; Details = "$($subDirs.Count)/4 sous-répertoires" }
    } else {
        return @{ Status = "Failed"; Message = "Répertoire de sauvegarde non trouvé: $BackupPath" }
    }
} -Category "Backup"

Test-Component "Scripts de sauvegarde" {
    $backupScript = Join-Path $PlatformPath "backup-complete.ps1"
    $restoreScript = Join-Path $PlatformPath "restore-backup.ps1"
    
    if ((Test-Path $backupScript) -and (Test-Path $restoreScript)) {
        return @{ Status = "Success"; Message = "Scripts de sauvegarde présents" }
    } elseif ((Test-Path $backupScript) -or (Test-Path $restoreScript)) {
        return @{ Status = "Warning"; Message = "Certains scripts de sauvegarde manquants" }
    } else {
        return @{ Status = "Failed"; Message = "Scripts de sauvegarde manquants" }
    }
} -Category "Backup"

Test-Component "Historique des sauvegardes" {
    $dbBackups = Get-ChildItem (Join-Path $BackupPath "database") -Filter "*.zip" -ErrorAction SilentlyContinue
    $fileBackups = Get-ChildItem (Join-Path $BackupPath "files") -Filter "*.zip" -ErrorAction SilentlyContinue
    
    if ($dbBackups -and $fileBackups) {
        $latestDb = ($dbBackups | Sort-Object CreationTime -Descending)[0]
        $latestFiles = ($fileBackups | Sort-Object CreationTime -Descending)[0]
        return @{ Status = "Success"; Message = "Sauvegardes disponibles"; Details = "DB: $($latestDb.Name), Files: $($latestFiles.Name)" }
    } elseif ($dbBackups -or $fileBackups) {
        return @{ Status = "Warning"; Message = "Sauvegardes partielles disponibles" }
    } else {
        return @{ Status = "Warning"; Message = "Aucune sauvegarde trouvée (normal si première installation)" }
    }
} -Category "Backup"

Test-Component "Base de données accessible" {
    try {
        $env:PGPASSWORD = "imprimerie_password"
        $result = psql -U imprimerie_user -d imprimerie_db -h localhost -c "SELECT NOW();" 2>$null
        if ($LASTEXITCODE -eq 0) {
            return @{ Status = "Success"; Message = "Base de données accessible" }
        } else {
            return @{ Status = "Failed"; Message = "Base de données non accessible" }
        }
    } catch {
        return @{ Status = "Failed"; Message = "Erreur d'accès à la base de données" }
    }
} -Category "Backup"

# Rapport final
Write-Host "`n" + ("═" * 80) -ForegroundColor Green
Write-Host "                    RAPPORT DE VALIDATION FINAL" -ForegroundColor Green
Write-Host ("═" * 80) -ForegroundColor Green

$totalTests = $results.Overall.TotalTests
$passed = $results.Overall.Passed
$failed = $results.Overall.Failed
$warnings = $results.Overall.Warnings

$successRate = [math]::Round(($passed / $totalTests) * 100, 1)

Write-Host "`n📊 STATISTIQUES GLOBALES:" -ForegroundColor Cyan
Write-Host "Tests total: $totalTests" -ForegroundColor White
Write-Host "Réussis: $passed" -ForegroundColor Green
Write-Host "Échoués: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Gray" })
Write-Host "Avertissements: $warnings" -ForegroundColor $(if ($warnings -gt 0) { "Yellow" } else { "Gray" })
Write-Host "Taux de réussite: $successRate%" -ForegroundColor $(if ($successRate -gt 90) { "Green" } elseif ($successRate -gt 75) { "Yellow" } else { "Red" })

# Détails par catégorie
$categories = @("Dependencies", "Platform", "Services", "Network", "Backup")
foreach ($category in $categories) {
    $categoryResults = $results[$category]
    $categoryPassed = ($categoryResults.Values | Where-Object { $_.Status -eq "Success" }).Count
    $categoryTotal = $categoryResults.Count
    
    if ($categoryTotal -gt 0) {
        $categoryRate = [math]::Round(($categoryPassed / $categoryTotal) * 100, 1)
        $color = if ($categoryRate -eq 100) { "Green" } elseif ($categoryRate -gt 75) { "Yellow" } else { "Red" }
        Write-Host "`n$category`: $categoryPassed/$categoryTotal ($categoryRate%)" -ForegroundColor $color
        
        if ($Detailed) {
            foreach ($test in $categoryResults.Keys) {
                $result = $categoryResults[$test]
                $symbol = switch ($result.Status) {
                    "Success" { "✅" }
                    "Warning" { "⚠️ " }
                    "Failed" { "❌" }
                }
                Write-Host "  $symbol $test - $($result.Message)" -ForegroundColor Gray
            }
        }
    }
}

# Recommandations
Write-Host "`n💡 RECOMMANDATIONS:" -ForegroundColor Cyan

if ($failed -eq 0 -and $warnings -eq 0) {
    Write-Host "🎉 Parfait ! Toutes les vérifications sont passées avec succès." -ForegroundColor Green
    Write-Host "Votre plateforme est prête pour la production." -ForegroundColor Green
} elseif ($failed -eq 0) {
    Write-Host "✅ Installation fonctionnelle avec quelques avertissements mineurs." -ForegroundColor Green
    Write-Host "Ces avertissements n'empêchent pas l'utilisation de la plateforme." -ForegroundColor Yellow
} elseif ($failed -le 2) {
    Write-Host "⚠️ Installation partiellement fonctionnelle." -ForegroundColor Yellow
    Write-Host "Quelques éléments nécessitent votre attention." -ForegroundColor Yellow
} else {
    Write-Host "❌ Des problèmes critiques ont été détectés." -ForegroundColor Red
    Write-Host "L'installation nécessite une intervention avant utilisation." -ForegroundColor Red
}

# Actions recommandées
if ($failed -gt 0) {
    Write-Host "`n🔧 ACTIONS RECOMMANDÉES:" -ForegroundColor Yellow
    
    # Vérifier les services les plus critiques
    if ($results.Services["Service Windows principal"].Status -eq "Failed") {
        Write-Host "1. Relancer: .\setup-startup.ps1" -ForegroundColor White
    }
    if ($results.Services["Processus PM2"].Status -eq "Failed") {
        Write-Host "2. Redémarrer PM2: pm2 restart all" -ForegroundColor White
    }
    if ($results.Network["Connectivité locale backend"].Status -eq "Failed" -or $results.Network["Connectivité locale frontend"].Status -eq "Failed") {
        Write-Host "3. Relancer la plateforme: .\start-platform.ps1 -Restart" -ForegroundColor White
    }
    if ($results.Dependencies.Values | Where-Object { $_.Status -eq "Failed" }) {
        Write-Host "4. Réinstaller les dépendances: .\install-dependencies.ps1" -ForegroundColor White
    }
}

Write-Host "`n🌐 ADRESSES D'ACCÈS (si tout fonctionne):" -ForegroundColor Cyan
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -like "*Ethernet*" -or $_.InterfaceAlias -like "*Wi-Fi*"} | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*"}).IPAddress | Select-Object -First 1
Write-Host "Local: http://localhost:3001" -ForegroundColor White
if ($localIP) {
    Write-Host "Réseau: http://$localIP:3001" -ForegroundColor White
}

Write-Host "`n🔍 Pour plus de détails, relancez avec: .\test-complete-installation.ps1 -Detailed" -ForegroundColor Gray

Write-Host "`n" + ("═" * 80) -ForegroundColor Green
Read-Host "Appuyez sur Entrée pour terminer"