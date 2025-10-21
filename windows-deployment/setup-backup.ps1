# ===============================================
# Script de configuration de la sauvegarde automatique
# Plateforme d'Imprimerie Numérique
# ===============================================

param(
    [string]$PlatformPath = "C:\Imprimerie-Platform",
    [string]$BackupPath = "C:\Imprimerie-Backups",
    [int]$RetentionDays = 7,
    [string]$BackupTime = "02:00"
)

Write-Host "=== CONFIGURATION DE LA SAUVEGARDE AUTOMATIQUE ===" -ForegroundColor Green
Write-Host "Répertoire de sauvegarde: $BackupPath" -ForegroundColor Yellow
Write-Host "Rétention: $RetentionDays jours" -ForegroundColor Yellow
Write-Host "Heure de sauvegarde: $BackupTime" -ForegroundColor Yellow

# Vérifier les privilèges administrateur
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERREUR: Ce script doit être exécuté en tant qu'administrateur" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "`n1. Création du répertoire de sauvegarde..." -ForegroundColor Cyan
    if (!(Test-Path $BackupPath)) {
        New-Item -ItemType Directory -Path $BackupPath -Force
        Write-Host "✓ Répertoire de sauvegarde créé: $BackupPath" -ForegroundColor Green
    } else {
        Write-Host "✓ Répertoire de sauvegarde existe déjà" -ForegroundColor Green
    }

    # Créer les sous-répertoires
    @("database", "files", "config", "logs") | ForEach-Object {
        $subDir = Join-Path $BackupPath $_
        if (!(Test-Path $subDir)) {
            New-Item -ItemType Directory -Path $subDir -Force
        }
    }

    Write-Host "`n2. Création du script de sauvegarde de la base de données..." -ForegroundColor Cyan
    @"
# Script de sauvegarde de la base de données PostgreSQL
`$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
`$backupPath = "$BackupPath"
`$platformPath = "$PlatformPath"
`$retentionDays = $RetentionDays

Write-Host "=== SAUVEGARDE BASE DE DONNÉES - `$timestamp ===" -ForegroundColor Green

try {
    # Définir les variables de connexion
    `$env:PGPASSWORD = "imprimerie_password"
    
    # Nom du fichier de sauvegarde
    `$backupFile = "`$backupPath\database\imprimerie_db_`$timestamp.sql"
    
    # Effectuer la sauvegarde
    Write-Host "Sauvegarde de la base de données..." -ForegroundColor Yellow
    `$result = & pg_dump -h localhost -U imprimerie_user -d imprimerie_db --no-password --clean --if-exists --create -f "`$backupFile"
    
    if (`$LASTEXITCODE -eq 0) {
        Write-Host "✓ Sauvegarde base de données réussie: `$backupFile" -ForegroundColor Green
        
        # Compression de la sauvegarde
        Write-Host "Compression de la sauvegarde..." -ForegroundColor Yellow
        Compress-Archive -Path "`$backupFile" -DestinationPath "`$backupFile.zip" -Force
        Remove-Item "`$backupFile" -Force
        
        Write-Host "✓ Sauvegarde compressée: `$backupFile.zip" -ForegroundColor Green
        
    } else {
        Write-Host "✗ Erreur lors de la sauvegarde de la base de données" -ForegroundColor Red
        Write-Host "Code d'erreur: `$LASTEXITCODE" -ForegroundColor Red
    }
    
    # Nettoyage des anciennes sauvegardes
    Write-Host "Nettoyage des anciennes sauvegardes..." -ForegroundColor Yellow
    `$cutoffDate = (Get-Date).AddDays(-`$retentionDays)
    Get-ChildItem "`$backupPath\database" -Filter "*.zip" | Where-Object { `$_.CreationTime -lt `$cutoffDate } | ForEach-Object {
        Write-Host "Suppression de l'ancienne sauvegarde: `$(`$_.Name)" -ForegroundColor Yellow
        Remove-Item `$_.FullName -Force
    }
    
} catch {
    Write-Host "✗ Erreur lors de la sauvegarde: `$_" -ForegroundColor Red
    "`$timestamp - Erreur sauvegarde DB: `$_" | Out-File -FilePath "`$backupPath\logs\backup-error.log" -Append
}

Write-Host "=== FIN SAUVEGARDE BASE DE DONNÉES ===" -ForegroundColor Green
"@ | Out-File -FilePath "$PlatformPath\backup-database.ps1" -Encoding UTF8

    Write-Host "`n3. Création du script de sauvegarde des fichiers..." -ForegroundColor Cyan
    @"
# Script de sauvegarde des fichiers de la plateforme
`$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
`$backupPath = "$BackupPath"
`$platformPath = "$PlatformPath"
`$retentionDays = $RetentionDays

Write-Host "=== SAUVEGARDE FICHIERS - `$timestamp ===" -ForegroundColor Green

try {
    # Sauvegarde des fichiers uploadés
    `$uploadsSource = "`$platformPath\uploads"
    `$uploadsBackup = "`$backupPath\files\uploads_`$timestamp.zip"
    
    if (Test-Path `$uploadsSource) {
        Write-Host "Sauvegarde des fichiers uploadés..." -ForegroundColor Yellow
        Compress-Archive -Path "`$uploadsSource\*" -DestinationPath `$uploadsBackup -Force
        Write-Host "✓ Fichiers uploadés sauvegardés: `$uploadsBackup" -ForegroundColor Green
    }
    
    # Sauvegarde de la configuration
    `$configBackup = "`$backupPath\config\config_`$timestamp.zip"
    `$configFiles = @(
        "`$platformPath\.env",
        "`$platformPath\ecosystem.config.js",
        "`$platformPath\backend\package.json",
        "`$platformPath\frontend\package.json"
    )
    
    `$existingConfigFiles = `$configFiles | Where-Object { Test-Path `$_ }
    if (`$existingConfigFiles) {
        Write-Host "Sauvegarde des fichiers de configuration..." -ForegroundColor Yellow
        Compress-Archive -Path `$existingConfigFiles -DestinationPath `$configBackup -Force
        Write-Host "✓ Configuration sauvegardée: `$configBackup" -ForegroundColor Green
    }
    
    # Sauvegarde des logs récents (derniers 7 jours)
    `$logsSource = "`$platformPath\logs"
    if (Test-Path `$logsSource) {
        `$recentLogs = Get-ChildItem `$logsSource -File | Where-Object { `$_.LastWriteTime -gt (Get-Date).AddDays(-7) }
        if (`$recentLogs) {
            `$logsBackup = "`$backupPath\logs\logs_`$timestamp.zip"
            Write-Host "Sauvegarde des logs récents..." -ForegroundColor Yellow
            Compress-Archive -Path (`$recentLogs.FullName) -DestinationPath `$logsBackup -Force
            Write-Host "✓ Logs sauvegardés: `$logsBackup" -ForegroundColor Green
        }
    }
    
    # Nettoyage des anciennes sauvegardes de fichiers
    Write-Host "Nettoyage des anciennes sauvegardes de fichiers..." -ForegroundColor Yellow
    `$cutoffDate = (Get-Date).AddDays(-`$retentionDays)
    
    @("files", "config", "logs") | ForEach-Object {
        `$folder = "`$backupPath\`$_"
        if (Test-Path `$folder) {
            Get-ChildItem `$folder -Filter "*.zip" | Where-Object { `$_.CreationTime -lt `$cutoffDate } | ForEach-Object {
                Write-Host "Suppression: `$(`$_.Name)" -ForegroundColor Yellow
                Remove-Item `$_.FullName -Force
            }
        }
    }
    
} catch {
    Write-Host "✗ Erreur lors de la sauvegarde des fichiers: `$_" -ForegroundColor Red
    "`$timestamp - Erreur sauvegarde fichiers: `$_" | Out-File -FilePath "`$backupPath\logs\backup-error.log" -Append
}

Write-Host "=== FIN SAUVEGARDE FICHIERS ===" -ForegroundColor Green
"@ | Out-File -FilePath "$PlatformPath\backup-files.ps1" -Encoding UTF8

    Write-Host "`n4. Création du script de sauvegarde complète..." -ForegroundColor Cyan
    @"
# Script de sauvegarde complète
`$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
`$platformPath = "$PlatformPath"
`$backupPath = "$BackupPath"

Write-Host "=== DÉBUT SAUVEGARDE COMPLÈTE - `$timestamp ===" -ForegroundColor Green

# Journal de sauvegarde
`$logFile = "`$backupPath\backup-complete.log"
"`$timestamp - Début sauvegarde complète" | Out-File -FilePath `$logFile -Append

try {
    # Sauvegarde de la base de données
    Write-Host "`n--- Sauvegarde Base de Données ---" -ForegroundColor Cyan
    & PowerShell.exe -ExecutionPolicy Bypass -File "`$platformPath\backup-database.ps1"
    
    # Attendre un peu pour éviter la surcharge
    Start-Sleep -Seconds 5
    
    # Sauvegarde des fichiers
    Write-Host "`n--- Sauvegarde Fichiers ---" -ForegroundColor Cyan
    & PowerShell.exe -ExecutionPolicy Bypass -File "`$platformPath\backup-files.ps1"
    
    # Création d'un fichier de statut
    `$statusFile = "`$backupPath\last-backup-status.json"
    `$status = @{
        timestamp = `$timestamp
        success = `$true
        database_backup = (Test-Path "`$backupPath\database\imprimerie_db_`$timestamp.sql.zip")
        files_backup = (Test-Path "`$backupPath\files\uploads_`$timestamp.zip")
        config_backup = (Test-Path "`$backupPath\config\config_`$timestamp.zip")
    }
    `$status | ConvertTo-Json | Out-File -FilePath `$statusFile -Encoding UTF8
    
    "`$timestamp - Sauvegarde complète terminée avec succès" | Out-File -FilePath `$logFile -Append
    Write-Host "=== SAUVEGARDE COMPLÈTE RÉUSSIE ===" -ForegroundColor Green
    
} catch {
    "`$timestamp - Erreur sauvegarde complète: `$_" | Out-File -FilePath `$logFile -Append
    Write-Host "✗ Erreur lors de la sauvegarde complète: `$_" -ForegroundColor Red
}
"@ | Out-File -FilePath "$PlatformPath\backup-complete.ps1" -Encoding UTF8

    Write-Host "`n5. Configuration de la tâche planifiée..." -ForegroundColor Cyan
    
    # Supprimer l'ancienne tâche si elle existe
    $taskName = "ImprimeriePlatformBackup"
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "Suppression de l'ancienne tâche planifiée..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    # Créer la nouvelle tâche planifiée
    Write-Host "Création de la tâche planifiée de sauvegarde..." -ForegroundColor Yellow
    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$PlatformPath\backup-complete.ps1`""
    
    # Analyser l'heure fournie
    $backupHour = [int]($BackupTime.Split(':')[0])
    $backupMinute = [int]($BackupTime.Split(':')[1])
    
    $trigger = New-ScheduledTaskTrigger -Daily -At (Get-Date -Hour $backupHour -Minute $backupMinute -Second 0 -Millisecond 0)
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable:$false

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Sauvegarde quotidienne automatique de la plateforme d'imprimerie (base de données et fichiers)"

    Write-Host "`n6. Création d'un script de restauration..." -ForegroundColor Cyan
    @"
# Script de restauration de la plateforme
param(
    [string]`$BackupDate,
    [switch]`$ListBackups
)

`$backupPath = "$BackupPath"
`$platformPath = "$PlatformPath"

if (`$ListBackups) {
    Write-Host "=== SAUVEGARDES DISPONIBLES ===" -ForegroundColor Green
    Write-Host "`nBase de données:" -ForegroundColor Cyan
    Get-ChildItem "`$backupPath\database" -Filter "*.zip" | Sort-Object CreationTime -Descending | ForEach-Object {
        Write-Host "  - `$(`$_.Name)" -ForegroundColor White
    }
    
    Write-Host "`nFichiers:" -ForegroundColor Cyan
    Get-ChildItem "`$backupPath\files" -Filter "*.zip" | Sort-Object CreationTime -Descending | ForEach-Object {
        Write-Host "  - `$(`$_.Name)" -ForegroundColor White
    }
    
    Write-Host "`nConfiguration:" -ForegroundColor Cyan
    Get-ChildItem "`$backupPath\config" -Filter "*.zip" | Sort-Object CreationTime -Descending | ForEach-Object {
        Write-Host "  - `$(`$_.Name)" -ForegroundColor White
    }
    
    Write-Host "`nUtilisation: .\restore-backup.ps1 -BackupDate YYYY-MM-DD_HH-mm-ss" -ForegroundColor Yellow
    exit
}

if (!`$BackupDate) {
    Write-Host "Usage: .\restore-backup.ps1 -BackupDate YYYY-MM-DD_HH-mm-ss" -ForegroundColor Red
    Write-Host "Ou: .\restore-backup.ps1 -ListBackups" -ForegroundColor Red
    exit 1
}

Write-Host "=== RESTAURATION DE LA SAUVEGARDE - `$BackupDate ===" -ForegroundColor Green

try {
    # Arrêter les services
    Write-Host "Arrêt de la plateforme..." -ForegroundColor Yellow
    Stop-Service -Name "ImprimerieService" -ErrorAction SilentlyContinue
    Set-Location `$platformPath
    pm2 stop all
    
    # Restauration de la base de données
    `$dbBackup = "`$backupPath\database\imprimerie_db_`$BackupDate.sql.zip"
    if (Test-Path `$dbBackup) {
        Write-Host "Restauration de la base de données..." -ForegroundColor Yellow
        `$tempSqlFile = "`$env:TEMP\restore_`$BackupDate.sql"
        
        Expand-Archive -Path `$dbBackup -DestinationPath `$env:TEMP -Force
        `$env:PGPASSWORD = "imprimerie_password"
        `$result = & psql -h localhost -U imprimerie_user -d imprimerie_db -f "`$tempSqlFile"
        
        if (`$LASTEXITCODE -eq 0) {
            Write-Host "✓ Base de données restaurée" -ForegroundColor Green
        } else {
            Write-Host "✗ Erreur lors de la restauration de la base" -ForegroundColor Red
        }
        
        Remove-Item `$tempSqlFile -Force -ErrorAction SilentlyContinue
    }
    
    # Restauration des fichiers
    `$filesBackup = "`$backupPath\files\uploads_`$BackupDate.zip"
    if (Test-Path `$filesBackup) {
        Write-Host "Restauration des fichiers uploadés..." -ForegroundColor Yellow
        if (Test-Path "`$platformPath\uploads") {
            Remove-Item "`$platformPath\uploads" -Recurse -Force
        }
        New-Item "`$platformPath\uploads" -ItemType Directory -Force
        Expand-Archive -Path `$filesBackup -DestinationPath "`$platformPath\uploads" -Force
        Write-Host "✓ Fichiers restaurés" -ForegroundColor Green
    }
    
    # Redémarrage des services
    Write-Host "Redémarrage de la plateforme..." -ForegroundColor Yellow
    Start-Service -Name "ImprimerieService"
    
    Write-Host "=== RESTAURATION TERMINÉE ===" -ForegroundColor Green
    
} catch {
    Write-Host "✗ Erreur lors de la restauration: `$_" -ForegroundColor Red
}
"@ | Out-File -FilePath "$PlatformPath\restore-backup.ps1" -Encoding UTF8

    Write-Host "`n7. Test de la sauvegarde..." -ForegroundColor Cyan
    Write-Host "Exécution d'un test de sauvegarde..." -ForegroundColor Yellow
    
    # Exécuter une sauvegarde de test
    & PowerShell.exe -ExecutionPolicy Bypass -File "$PlatformPath\backup-complete.ps1"
    
    # Vérifier le résultat
    Start-Sleep -Seconds 5
    $statusFile = "$BackupPath\last-backup-status.json"
    if (Test-Path $statusFile) {
        $status = Get-Content $statusFile | ConvertFrom-Json
        Write-Host "✓ Test de sauvegarde réalisé à: $($status.timestamp)" -ForegroundColor Green
    }

    Write-Host "`n=== SAUVEGARDE AUTOMATIQUE CONFIGURÉE ===" -ForegroundColor Green
    Write-Host "Répertoire de sauvegarde: $BackupPath" -ForegroundColor Cyan
    Write-Host "Heure de sauvegarde: $BackupTime quotidiennement" -ForegroundColor Cyan
    Write-Host "Rétention: $RetentionDays jours" -ForegroundColor Cyan
    Write-Host "`nScripts disponibles:" -ForegroundColor Yellow
    Write-Host "  • backup-complete.ps1 - Sauvegarde manuelle complète" -ForegroundColor White
    Write-Host "  • restore-backup.ps1 - Restauration depuis une sauvegarde" -ForegroundColor White
    Write-Host "  • restore-backup.ps1 -ListBackups - Lister les sauvegardes" -ForegroundColor White
    Write-Host "`nTâche planifiée: $taskName créée" -ForegroundColor Cyan

} catch {
    Write-Host "`nERREUR lors de la configuration de la sauvegarde: $_" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

Read-Host "`nAppuyez sur Entrée pour continuer"