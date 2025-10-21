# ===============================================
# Script d'installation des dépendances Windows
# Plateforme d'Imprimerie Numérique
# ===============================================

Write-Host "=== INSTALLATION DES DÉPENDANCES WINDOWS ===" -ForegroundColor Green
Write-Host "Ce script va installer toutes les dépendances nécessaires" -ForegroundColor Yellow

# Vérifier les privilèges administrateur
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERREUR: Ce script doit être exécuté en tant qu'administrateur" -ForegroundColor Red
    Write-Host "Clic droit -> 'Exécuter en tant qu'administrateur'" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

# Fonction d'installation de Chocolatey si nécessaire
function Install-Chocolatey {
    if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Host "Installation de Chocolatey..." -ForegroundColor Yellow
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
        refreshenv
    } else {
        Write-Host "Chocolatey déjà installé ✓" -ForegroundColor Green
    }
}

# Installation des dépendances principales
try {
    Write-Host "`n1. Installation de Chocolatey..." -ForegroundColor Cyan
    Install-Chocolatey

    Write-Host "`n2. Installation de Node.js..." -ForegroundColor Cyan
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        choco install nodejs --version=18.18.2 -y
        refreshenv
    } else {
        Write-Host "Node.js déjà installé ✓" -ForegroundColor Green
    }

    Write-Host "`n3. Installation de PostgreSQL..." -ForegroundColor Cyan
    if (!(Get-Service postgresql* -ErrorAction SilentlyContinue)) {
        choco install postgresql --params '/Password:imprimerie_admin123' -y
        # Attendre que le service se lance
        Start-Sleep -Seconds 10
    } else {
        Write-Host "PostgreSQL déjà installé ✓" -ForegroundColor Green
    }

    Write-Host "`n4. Installation de PM2..." -ForegroundColor Cyan
    npm install -g pm2
    npm install -g pm2-windows-startup
    pm2-startup install

    Write-Host "`n5. Installation de Git..." -ForegroundColor Cyan
    if (!(Get-Command git -ErrorAction SilentlyContinue)) {
        choco install git -y
        refreshenv
    } else {
        Write-Host "Git déjà installé ✓" -ForegroundColor Green
    }

    Write-Host "`n6. Configuration de l'environnement..." -ForegroundColor Cyan
    # Ajouter les chemins nécessaires aux variables d'environnement si pas déjà fait
    $paths = @(
        "C:\Program Files\PostgreSQL\15\bin",
        "C:\Program Files\nodejs",
        "$env:APPDATA\npm"
    )
    
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "Machine")
    foreach ($path in $paths) {
        if ($currentPath -notlike "*$path*") {
            [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$path", "Machine")
            Write-Host "Ajouté $path au PATH" -ForegroundColor Yellow
        }
    }

    Write-Host "`n=== INSTALLATION TERMINÉE AVEC SUCCÈS ===" -ForegroundColor Green
    Write-Host "Redémarrage recommandé pour finaliser l'installation" -ForegroundColor Yellow
    Write-Host "Après redémarrage, exécutez setup-platform.ps1" -ForegroundColor Cyan

} catch {
    Write-Host "`nERREUR lors de l'installation: $_" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

Read-Host "`nAppuyez sur Entrée pour continuer"