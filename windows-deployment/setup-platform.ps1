# ===============================================
# Script de configuration de la plateforme Windows
# Plateforme d'Imprimerie Numérique
# ===============================================

param(
    [string]$PlatformPath = "C:\Imprimerie-Platform",
    [string]$DatabasePassword = "imprimerie_admin123"
)

Write-Host "=== CONFIGURATION DE LA PLATEFORME WINDOWS ===" -ForegroundColor Green
Write-Host "Répertoire d'installation: $PlatformPath" -ForegroundColor Yellow

# Vérifier les privilèges administrateur
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERREUR: Ce script doit être exécuté en tant qu'administrateur" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "`n1. Création du répertoire de la plateforme..." -ForegroundColor Cyan
    if (!(Test-Path $PlatformPath)) {
        New-Item -ItemType Directory -Path $PlatformPath -Force
    }
    Set-Location $PlatformPath

    Write-Host "`n2. Configuration de PostgreSQL..." -ForegroundColor Cyan
    # Créer l'utilisateur et la base de données
    $env:PGPASSWORD = $DatabasePassword
    
    # Vérifier si la base existe déjà
    $dbExists = & psql -U postgres -h localhost -c "SELECT 1 FROM pg_database WHERE datname='imprimerie_db';" 2>$null
    if ($LASTEXITCODE -ne 0 -or $dbExists -notlike "*1*") {
        Write-Host "Création de la base de données..." -ForegroundColor Yellow
        & psql -U postgres -h localhost -c "CREATE USER imprimerie_user WITH PASSWORD 'imprimerie_password';"
        & psql -U postgres -h localhost -c "CREATE DATABASE imprimerie_db OWNER imprimerie_user;"
        & psql -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE imprimerie_db TO imprimerie_user;"
    } else {
        Write-Host "Base de données déjà configurée ✓" -ForegroundColor Green
    }

    Write-Host "`n3. Copie des fichiers de la plateforme..." -ForegroundColor Cyan
    # Copier tous les fichiers de la plateforme (à adapter selon votre source)
    # Si les fichiers sont dans le répertoire courant, les copier
    if (Test-Path ".\frontend") {
        Copy-Item -Path ".\*" -Destination $PlatformPath -Recurse -Force -Exclude @("windows-deployment", "node_modules", ".git")
    }

    Write-Host "`n4. Installation des dépendances Node.js..." -ForegroundColor Cyan
    Set-Location "$PlatformPath\backend"
    npm install --production
    
    Set-Location "$PlatformPath\frontend"
    npm install --production

    Write-Host "`n5. Configuration des variables d'environnement..." -ForegroundColor Cyan
    Set-Location $PlatformPath
    
    # Créer le fichier .env pour Windows
    @"
# Configuration PostgreSQL pour Windows
DB_USER=imprimerie_user
DB_PASSWORD=imprimerie_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=imprimerie_db
NODE_ENV=production

# URLs et ports
FRONTEND_URL=http://localhost:3001
PUBLIC_API_URL=http://localhost:5001
PORT=5001

# JWT Configuration
JWT_SECRET=bfd12b7c521fd8f87115b1c8327aaa668a9d95de6a36d6300fc3e10b609f1ce85ed49f4bfff6927b80049260021f5606162779f31b3be9bfdb66b0ed09474d20
JWT_REFRESH_SECRET=ed4d13288ae3975fc508407ddec8e5592406bea43333046f69f69c317fde0f65
JWT_EXPIRE_TIME=24h
JWT_REFRESH_EXPIRE_TIME=7d
"@ | Out-File -FilePath ".env" -Encoding UTF8

    Write-Host "`n6. Création de l'écosystème PM2 pour Windows..." -ForegroundColor Cyan
    @"
module.exports = {
  apps: [
    {
      name: 'imprimerie-backend',
      script: 'server.js',
      cwd: '$($PlatformPath.Replace('\', '\\'))\\backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
      error_file: '$($PlatformPath.Replace('\', '\\'))\\logs\\backend-error.log',
      out_file: '$($PlatformPath.Replace('\', '\\'))\\logs\\backend-out.log',
      log_file: '$($PlatformPath.Replace('\', '\\'))\\logs\\backend-combined.log',
      time: true,
      exec_mode: 'fork',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'imprimerie-frontend',
      script: 'npm',
      args: 'start',
      cwd: '$($PlatformPath.Replace('\', '\\'))\\frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        BROWSER: 'none'
      },
      error_file: '$($PlatformPath.Replace('\', '\\'))\\logs\\frontend-error.log',
      out_file: '$($PlatformPath.Replace('\', '\\'))\\logs\\frontend-out.log',
      log_file: '$($PlatformPath.Replace('\', '\\'))\\logs\\frontend-combined.log',
      time: true,
      exec_mode: 'fork',
      kill_timeout: 5000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
"@ | Out-File -FilePath "ecosystem.config.js" -Encoding UTF8

    Write-Host "`n7. Création du répertoire de logs..." -ForegroundColor Cyan
    if (!(Test-Path "$PlatformPath\logs")) {
        New-Item -ItemType Directory -Path "$PlatformPath\logs" -Force
    }

    Write-Host "`n8. Configuration du pare-feu Windows..." -ForegroundColor Cyan
    # Ouvrir les ports nécessaires
    netsh advfirewall firewall add rule name="Imprimerie Backend" dir=in action=allow protocol=TCP localport=5001
    netsh advfirewall firewall add rule name="Imprimerie Frontend" dir=in action=allow protocol=TCP localport=3001
    netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=TCP localport=5432

    Write-Host "`n9. Test de la base de données..." -ForegroundColor Cyan
    $env:PGPASSWORD = "imprimerie_password"
    $testResult = & psql -U imprimerie_user -d imprimerie_db -h localhost -c "SELECT NOW();" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Connexion à la base de données réussie ✓" -ForegroundColor Green
    } else {
        Write-Host "ATTENTION: Problème de connexion à la base de données" -ForegroundColor Yellow
    }

    Write-Host "`n=== CONFIGURATION TERMINÉE AVEC SUCCÈS ===" -ForegroundColor Green
    Write-Host "Répertoire de la plateforme: $PlatformPath" -ForegroundColor Cyan
    Write-Host "Pour démarrer la plateforme, exécutez: start-platform.ps1" -ForegroundColor Yellow
    Write-Host "Pour configurer le démarrage automatique, exécutez: setup-startup.ps1" -ForegroundColor Yellow

} catch {
    Write-Host "`nERREUR lors de la configuration: $_" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

Read-Host "`nAppuyez sur Entrée pour continuer"