# ===============================================
# Script de configuration de l'accès réseau local
# Plateforme d'Imprimerie Numérique
# ===============================================

param(
    [string]$PlatformPath = "C:\Imprimerie-Platform"
)

Write-Host "=== CONFIGURATION DE L'ACCÈS RÉSEAU LOCAL ===" -ForegroundColor Green

# Vérifier les privilèges administrateur
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERREUR: Ce script doit être exécuté en tant qu'administrateur" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "`n1. Configuration du pare-feu Windows..." -ForegroundColor Cyan
    
    # Supprimer les anciennes règles si elles existent
    $rulesToRemove = @("Imprimerie Backend", "Imprimerie Frontend", "PostgreSQL Imprimerie")
    foreach ($rule in $rulesToRemove) {
        try {
            netsh advfirewall firewall delete rule name="$rule"
        } catch {
            # Ignorer si la règle n'existe pas
        }
    }
    
    # Créer les nouvelles règles de pare-feu
    Write-Host "Création des règles de pare-feu..." -ForegroundColor Yellow
    netsh advfirewall firewall add rule name="Imprimerie Backend" dir=in action=allow protocol=TCP localport=5001 profile=private,domain
    netsh advfirewall firewall add rule name="Imprimerie Frontend" dir=in action=allow protocol=TCP localport=3001 profile=private,domain
    netsh advfirewall firewall add rule name="PostgreSQL Imprimerie" dir=in action=allow protocol=TCP localport=5432 profile=private,domain

    Write-Host "`n2. Obtention de l'adresse IP locale..." -ForegroundColor Cyan
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -like "*Ethernet*" -or $_.InterfaceAlias -like "*Wi-Fi*"} | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*"}).IPAddress | Select-Object -First 1
    
    if (!$localIP) {
        $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}).IPAddress | Select-Object -First 1
    }
    
    Write-Host "Adresse IP locale détectée: $localIP" -ForegroundColor Yellow

    Write-Host "`n3. Configuration du service de découverte réseau..." -ForegroundColor Cyan
    # Activer la découverte réseau et le partage de fichiers pour le réseau privé
    netsh advfirewall firewall set rule group="Network Discovery" new enable=Yes
    netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes

    Write-Host "`n4. Configuration des variables d'environnement réseau..." -ForegroundColor Cyan
    Set-Location $PlatformPath
    
    # Mettre à jour le fichier .env avec la configuration réseau
    $envContent = Get-Content ".env" -Raw
    
    # Ajouter ou modifier les variables réseau
    $networkConfig = @"

# Configuration réseau local
LOCAL_IP=$localIP
NETWORK_ACCESS=true
ALLOW_EXTERNAL_ACCESS=true
"@
    
    if ($envContent -notlike "*LOCAL_IP*") {
        $envContent += $networkConfig
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        Write-Host "Configuration réseau ajoutée au fichier .env" -ForegroundColor Yellow
    }

    Write-Host "`n5. Modification de la configuration du backend pour l'accès réseau..." -ForegroundColor Cyan
    
    # Vérifier et modifier la configuration du backend si nécessaire
    $serverJsPath = "$PlatformPath\backend\server.js"
    if (Test-Path $serverJsPath) {
        $serverContent = Get-Content $serverJsPath -Raw
        if ($serverContent -like "*localhost*" -and $serverContent -notlike "*0.0.0.0*") {
            Write-Host "Modification du backend pour accepter les connexions externes..." -ForegroundColor Yellow
            # Note: Il faudrait modifier server.js pour écouter sur 0.0.0.0 au lieu de localhost
            Write-Host "⚠ IMPORTANT: Vérifiez que le backend écoute sur 0.0.0.0:5001 et non localhost:5001" -ForegroundColor Red
        }
    }

    Write-Host "`n6. Test de connectivité réseau..." -ForegroundColor Cyan
    
    # Test des ports
    $portsToTest = @(5001, 3001)
    foreach ($port in $portsToTest) {
        try {
            $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
            $listener.Start()
            $listener.Stop()
            Write-Host "✓ Port $port disponible" -ForegroundColor Green
        } catch {
            Write-Host "⚠ Port $port peut être en cours d'utilisation: $_" -ForegroundColor Yellow
        }
    }

    Write-Host "`n7. Création d'un script de test de connectivité..." -ForegroundColor Cyan
    @"
# Script de test de connectivité réseau
`$localIP = "$localIP"

Write-Host "=== TEST DE CONNECTIVITÉ RÉSEAU ===" -ForegroundColor Green
Write-Host "Adresse IP locale: `$localIP" -ForegroundColor Cyan

# Test du backend
try {
    `$response = Invoke-WebRequest -Uri "http://`$localIP:5001/api/health" -TimeoutSec 5 -UseBasicParsing
    if (`$response.StatusCode -eq 200) {
        Write-Host "✓ Backend accessible sur le réseau local" -ForegroundColor Green
        Write-Host "  URL: http://`$localIP:5001" -ForegroundColor Cyan
    } else {
        Write-Host "⚠ Backend répond mais avec un code d'erreur: `$(`$response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Backend non accessible sur le réseau local" -ForegroundColor Red
    Write-Host "  Erreur: `$_" -ForegroundColor Red
}

# Test du frontend
try {
    `$response = Invoke-WebRequest -Uri "http://`$localIP:3001" -TimeoutSec 5 -UseBasicParsing
    if (`$response.StatusCode -eq 200) {
        Write-Host "✓ Frontend accessible sur le réseau local" -ForegroundColor Green
        Write-Host "  URL: http://`$localIP:3001" -ForegroundColor Cyan
    } else {
        Write-Host "⚠ Frontend répond mais avec un code d'erreur: `$(`$response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Frontend non accessible sur le réseau local" -ForegroundColor Red
    Write-Host "  Erreur: `$_" -ForegroundColor Red
}

Write-Host "`n=== INSTRUCTIONS D'ACCÈS DEPUIS D'AUTRES APPAREILS ===" -ForegroundColor Yellow
Write-Host "1. Depuis un navigateur web sur un autre appareil du réseau:" -ForegroundColor Cyan
Write-Host "   - Accédez à: http://`$localIP:3001" -ForegroundColor White
Write-Host "   - Ou utilisez le nom de la machine: http://`$env:COMPUTERNAME.local:3001" -ForegroundColor White
Write-Host "2. API Backend disponible sur:" -ForegroundColor Cyan
Write-Host "   - http://`$localIP:5001/api" -ForegroundColor White
Write-Host "`n3. Si l'accès ne fonctionne pas:" -ForegroundColor Cyan
Write-Host "   - Vérifiez que les appareils sont sur le même réseau Wi-Fi/Ethernet" -ForegroundColor White
Write-Host "   - Vérifiez les paramètres de pare-feu de votre routeur" -ForegroundColor White
Write-Host "   - Essayez de redémarrer la plateforme" -ForegroundColor White

Read-Host "`nAppuyez sur Entrée pour continuer"
"@ | Out-File -FilePath "$PlatformPath\test-network-connectivity.ps1" -Encoding UTF8

    Write-Host "`n8. Configuration du service de nom de machine (mDNS)..." -ForegroundColor Cyan
    # Activer le service de publication de nom de machine
    $service = Get-Service -Name "Dnscache" -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -ne "Running") {
            Start-Service -Name "Dnscache"
        }
        Set-Service -Name "Dnscache" -StartupType Automatic
        Write-Host "✓ Service DNS configuré" -ForegroundColor Green
    }

    Write-Host "`n=== CONFIGURATION RÉSEAU TERMINÉE ===" -ForegroundColor Green
    Write-Host "Adresse IP locale: $localIP" -ForegroundColor Cyan
    Write-Host "Ports ouverts: 3001 (Frontend), 5001 (Backend)" -ForegroundColor Cyan
    Write-Host "`nAccès depuis d'autres appareils du réseau:" -ForegroundColor Yellow
    Write-Host "  • Frontend: http://$localIP:3001" -ForegroundColor White
    Write-Host "  • Backend: http://$localIP:5001/api" -ForegroundColor White
    Write-Host "  • Alternative: http://$env:COMPUTERNAME.local:3001" -ForegroundColor White
    Write-Host "`nPour tester l'accès réseau, exécutez: test-network-connectivity.ps1" -ForegroundColor Cyan

} catch {
    Write-Host "`nERREUR lors de la configuration réseau: $_" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

Read-Host "`nAppuyez sur Entrée pour continuer"