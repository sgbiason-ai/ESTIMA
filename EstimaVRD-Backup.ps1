$ErrorActionPreference = "Stop"

$ProjectPath = "C:\Projet\Estima"
$DriveBackup = "G:\Mon Drive\EstimaVRD-Backups"
$ExcludeDirs = @("node_modules", "dist", ".claude")
$EnvBackupName = "_env.local.backup"
$NodeVersion = "22.14.0"
$NodeUrl     = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-x64.msi"

# ── Cles Firebase (template pour nouveau PC) ─────────────────────────────
$EnvTemplate = @"
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Sentry
VITE_SENTRY_DSN=

# App
VITE_APP_ENV=development
VITE_APP_VERSION=2.0.0
"@

function Show-Menu {
    Clear-Host
    Write-Host ""
    Write-Host "  =========================================="  -ForegroundColor Cyan
    Write-Host "     EstimaVRD - Sauvegarde et Restauration"   -ForegroundColor Cyan
    Write-Host "  =========================================="  -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [1] Sauvegarder sur Google Drive"            -ForegroundColor Green
    Write-Host "  [2] Restaurer depuis Google Drive"           -ForegroundColor Yellow
    Write-Host "  [3] Voir les sauvegardes existantes"         -ForegroundColor Magenta
    Write-Host "  [4] Installation complete (nouveau PC)"      -ForegroundColor Blue
    Write-Host "  [5] Quitter"                                 -ForegroundColor Gray
    Write-Host ""
}

# ── Verifier si Node.js est installe ─────────────────────────────────────

function Test-NodeInstalled {
    try {
        $ver = & node --version 2>$null
        if ($ver) { return $true }
    } catch {}
    return $false
}

# ── Installer Node.js automatiquement ────────────────────────────────────

function Install-Node {
    Write-Host ""
    Write-Host "  Node.js non detecte. Installation en cours..." -ForegroundColor Yellow
    $msiPath = Join-Path $env:TEMP "node-installer.msi"

    Write-Host "  Telechargement de Node.js v$NodeVersion..." -ForegroundColor DarkGray
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $NodeUrl -OutFile $msiPath -UseBasicParsing
    } catch {
        Write-Host "  ERREUR : impossible de telecharger Node.js" -ForegroundColor Red
        Write-Host "  Installez manuellement depuis https://nodejs.org" -ForegroundColor Yellow
        return $false
    }

    Write-Host "  Installation silencieuse (peut prendre 1-2 min)..." -ForegroundColor DarkGray
    $proc = Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait -PassThru
    Remove-Item $msiPath -Force -ErrorAction SilentlyContinue

    if ($proc.ExitCode -ne 0) {
        Write-Host "  ERREUR : installation echouee (code $($proc.ExitCode))" -ForegroundColor Red
        Write-Host "  Installez manuellement depuis https://nodejs.org" -ForegroundColor Yellow
        return $false
    }

    # Rafraichir le PATH pour cette session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    if (Test-NodeInstalled) {
        $ver = & node --version
        Write-Host "  Node.js $ver installe avec succes !" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  ERREUR : Node.js installe mais non detecte dans le PATH" -ForegroundColor Red
        Write-Host "  Fermez et rouvrez PowerShell, puis relancez le script" -ForegroundColor Yellow
        return $false
    }
}

# ── SAUVEGARDE ───────────────────────────────────────────────────────────

function Do-Backup {
    Write-Host ""
    Write-Host "  Sauvegarde en cours..." -ForegroundColor Cyan

    if (-not (Test-Path $ProjectPath)) {
        Write-Host "  ERREUR : Projet non trouve" -ForegroundColor Red
        return
    }

    if (-not (Test-Path $DriveBackup)) {
        New-Item -ItemType Directory -Path $DriveBackup -Force | Out-Null
    }

    $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $zipName = "EstimaVRD_$timestamp.zip"
    $zipPath = Join-Path $DriveBackup $zipName
    $tempDir = Join-Path $env:TEMP "EstimaVRD_backup_$timestamp"

    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }

    Write-Host "  Copie des fichiers..." -ForegroundColor DarkGray

    Get-ChildItem -Path $ProjectPath -Recurse -Force | Where-Object {
        $rel = $_.FullName.Substring($ProjectPath.Length + 1)
        $skip = $false
        foreach ($d in $ExcludeDirs) {
            if ($rel -like "$d\*" -or $rel -eq $d) { $skip = $true; break }
        }
        -not $skip
    } | ForEach-Object {
        $dest = Join-Path $tempDir $_.FullName.Substring($ProjectPath.Length + 1)
        if ($_.PSIsContainer) {
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
        } else {
            $parent = Split-Path $dest -Parent
            if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
            Copy-Item $_.FullName $dest -Force
        }
    }

    # Inclure .env.local (renomme pour securite)
    $envSrc = Join-Path $ProjectPath ".env.local"
    if (Test-Path $envSrc) {
        Copy-Item $envSrc (Join-Path $tempDir $EnvBackupName) -Force
        Write-Host "  .env.local inclus dans le backup." -ForegroundColor DarkGray
    }

    Write-Host "  Compression..." -ForegroundColor DarkGray
    Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
    Remove-Item $tempDir -Recurse -Force

    $sizeMB = (Get-Item $zipPath).Length / 1MB
    $sizeStr = "{0:N1} Mo" -f $sizeMB

    Write-Host ""
    Write-Host "  SAUVEGARDE REUSSIE !" -ForegroundColor Green
    Write-Host "  Fichier : $zipName"   -ForegroundColor White
    Write-Host "  Taille  : $sizeStr"   -ForegroundColor White
    Write-Host "  Dossier : $DriveBackup" -ForegroundColor DarkGray
    Write-Host ""

    $all = Get-ChildItem $DriveBackup -Filter "EstimaVRD_*.zip" | Sort-Object Name -Descending
    if ($all.Count -gt 10) {
        $old = $all | Select-Object -Skip 10
        foreach ($f in $old) {
            Remove-Item $f.FullName -Force
            Write-Host "  Ancien backup supprime : $($f.Name)" -ForegroundColor DarkGray
        }
    }
}

# ── RESTAURATION ─────────────────────────────────────────────────────────

function Do-Restore {
    Write-Host ""

    if (-not (Test-Path $DriveBackup)) {
        Write-Host "  Aucun dossier de backup trouve." -ForegroundColor Red
        return
    }

    $all = Get-ChildItem $DriveBackup -Filter "EstimaVRD_*.zip" | Sort-Object Name -Descending
    if ($all.Count -eq 0) {
        Write-Host "  Aucune sauvegarde trouvee." -ForegroundColor Yellow
        return
    }

    Write-Host "  Sauvegardes disponibles :" -ForegroundColor Cyan
    Write-Host ""
    for ($i = 0; $i -lt $all.Count; $i++) {
        $b = $all[$i]
        $sz = "{0:N1} Mo" -f ($b.Length / 1MB)
        $dt = $b.Name -replace "EstimaVRD_","" -replace "\.zip","" -replace "_"," "
        Write-Host "  [$($i+1)] $dt  ($sz)" -ForegroundColor White
    }

    Write-Host ""
    $choix = Read-Host "  Numero du backup (ou Entree pour annuler)"
    if (-not $choix) { return }

    $idx = [int]$choix - 1
    if ($idx -lt 0 -or $idx -ge $all.Count) {
        Write-Host "  Choix invalide." -ForegroundColor Red
        return
    }

    $selected = $all[$idx]

    # Detecter si c'est une restauration sur projet existant ou nouveau
    $isNew = -not (Test-Path $ProjectPath)

    if (-not $isNew) {
        Write-Host ""
        Write-Host "  ATTENTION : ceci remplace le contenu de $ProjectPath" -ForegroundColor Yellow
        Write-Host "  (.env.local et node_modules seront preserves)"       -ForegroundColor Yellow
        $ok = Read-Host "  Confirmer ? (O/N)"
        if ($ok -notmatch "^[oOyY]") {
            Write-Host "  Annule." -ForegroundColor Gray
            return
        }
    }

    Write-Host ""
    Write-Host "  Restauration en cours..." -ForegroundColor Cyan

    # Creer le dossier projet si absent
    if ($isNew) {
        New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
        Write-Host "  Dossier cree : $ProjectPath" -ForegroundColor DarkGray
    }

    # Sauvegarder .env.local si present
    $envFile = Join-Path $ProjectPath ".env.local"
    $envSave = $null
    if (Test-Path $envFile) { $envSave = Get-Content $envFile -Raw }

    # Nettoyer le projet existant (sauf node_modules et .env.local)
    if (-not $isNew) {
        Get-ChildItem -Path $ProjectPath -Force | Where-Object {
            $_.Name -notin @("node_modules", ".env.local", ".claude")
        } | Remove-Item -Recurse -Force
    }

    # Dezipper
    Write-Host "  Extraction..." -ForegroundColor DarkGray
    Expand-Archive -Path $selected.FullName -DestinationPath $ProjectPath -Force

    # Restaurer .env.local
    $envBackupFile = Join-Path $ProjectPath $EnvBackupName
    if ($envSave) {
        Set-Content -Path $envFile -Value $envSave -NoNewline
        Write-Host "  .env.local preserve (existant)." -ForegroundColor DarkGray
    } elseif (Test-Path $envBackupFile) {
        Copy-Item $envBackupFile $envFile -Force
        Remove-Item $envBackupFile -Force
        Write-Host "  .env.local restaure depuis le backup !" -ForegroundColor Green
    } elseif (-not (Test-Path $envFile)) {
        Set-Content -Path $envFile -Value $EnvTemplate -NoNewline
        Write-Host ""
        Write-Host "  .env.local cree avec un template vide." -ForegroundColor Yellow
        Write-Host "  IMPORTANT : remplissez les cles Firebase avant de lancer l'app !" -ForegroundColor Yellow
        Write-Host "  Fichier : $envFile" -ForegroundColor DarkGray
    }
    # Nettoyer le fichier backup renomme s'il traine
    if (Test-Path $envBackupFile) { Remove-Item $envBackupFile -Force }

    # Verifier Node.js
    if (-not (Test-NodeInstalled)) {
        $installed = Install-Node
        if (-not $installed) {
            Write-Host ""
            Write-Host "  Restauration terminee SANS npm install." -ForegroundColor Yellow
            Write-Host "  Installez Node.js puis lancez : cd $ProjectPath && npm install" -ForegroundColor Yellow
            return
        }
    }

    # npm install
    Write-Host "  npm install (peut prendre 1-2 min)..." -ForegroundColor DarkGray
    Push-Location $ProjectPath
    & npm install --silent 2>$null
    Pop-Location

    Write-Host ""
    Write-Host "  RESTAURATION REUSSIE !" -ForegroundColor Green
    Write-Host "  Projet pret dans $ProjectPath" -ForegroundColor White

    if (-not $envSave -and $isNew) {
        Write-Host ""
        Write-Host "  PROCHAINE ETAPE :" -ForegroundColor Cyan
        Write-Host "  1. Editez $envFile avec vos cles Firebase" -ForegroundColor White
        Write-Host "  2. Ouvrez un terminal dans $ProjectPath" -ForegroundColor White
        Write-Host "  3. Lancez : npm run dev" -ForegroundColor White
    }
    Write-Host ""
}

# ── INSTALLATION COMPLETE (nouveau PC) ───────────────────────────────────

function Do-FullInstall {
    Write-Host ""
    Write-Host "  =========================================="  -ForegroundColor Blue
    Write-Host "     Installation complete - Nouveau PC"       -ForegroundColor Blue
    Write-Host "  =========================================="  -ForegroundColor Blue
    Write-Host ""

    # Etape 1 : Verifier Google Drive
    if (-not (Test-Path $DriveBackup)) {
        Write-Host "  ERREUR : Google Drive non trouve ($DriveBackup)" -ForegroundColor Red
        Write-Host "  Installez Google Drive for Desktop et synchronisez votre Drive." -ForegroundColor Yellow
        Write-Host "  Puis relancez ce script." -ForegroundColor Yellow
        return
    }

    # Verifier qu'il y a des backups
    $all = Get-ChildItem $DriveBackup -Filter "EstimaVRD_*.zip" -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    if ($all.Count -eq 0) {
        Write-Host "  ERREUR : aucune sauvegarde trouvee dans $DriveBackup" -ForegroundColor Red
        return
    }

    Write-Host "  Etapes de l'installation :" -ForegroundColor Cyan
    Write-Host "    1. Verification de Node.js (install auto si absent)" -ForegroundColor DarkGray
    Write-Host "    2. Creation du dossier projet" -ForegroundColor DarkGray
    Write-Host "    3. Restauration du dernier backup" -ForegroundColor DarkGray
    Write-Host "    4. Creation du .env.local (template)" -ForegroundColor DarkGray
    Write-Host "    5. npm install" -ForegroundColor DarkGray
    Write-Host ""

    $latest = $all[0]
    $sz = "{0:N1} Mo" -f ($latest.Length / 1MB)
    Write-Host "  Backup le plus recent : $($latest.Name) ($sz)" -ForegroundColor White
    Write-Host ""
    $ok = Read-Host "  Lancer l'installation complete ? (O/N)"
    if ($ok -notmatch "^[oOyY]") {
        Write-Host "  Annule." -ForegroundColor Gray
        return
    }

    Write-Host ""

    # Etape 1 : Node.js
    Write-Host "  [1/5] Verification de Node.js..." -ForegroundColor Cyan
    if (Test-NodeInstalled) {
        $ver = & node --version
        Write-Host "         Node.js $ver detecte." -ForegroundColor Green
    } else {
        $installed = Install-Node
        if (-not $installed) { return }
    }

    # Etape 2 : Creer le dossier
    Write-Host "  [2/5] Creation du dossier projet..." -ForegroundColor Cyan
    if (Test-Path $ProjectPath) {
        Write-Host "         Dossier existe deja. Nettoyage..." -ForegroundColor DarkGray
        Get-ChildItem -Path $ProjectPath -Force | Where-Object {
            $_.Name -notin @("node_modules", ".env.local")
        } | Remove-Item -Recurse -Force
    } else {
        New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
    }
    Write-Host "         $ProjectPath" -ForegroundColor Green

    # Etape 3 : Dezipper
    Write-Host "  [3/5] Extraction du backup..." -ForegroundColor Cyan
    Expand-Archive -Path $latest.FullName -DestinationPath $ProjectPath -Force
    Write-Host "         $($latest.Name) extrait." -ForegroundColor Green

    # Etape 4 : .env.local (auto-restaure depuis le backup)
    Write-Host "  [4/5] Configuration .env.local..." -ForegroundColor Cyan
    $envFile = Join-Path $ProjectPath ".env.local"
    $envBackupFile = Join-Path $ProjectPath $EnvBackupName
    if (Test-Path $envFile) {
        Write-Host "         .env.local existant preserve." -ForegroundColor Green
    } elseif (Test-Path $envBackupFile) {
        Copy-Item $envBackupFile $envFile -Force
        Remove-Item $envBackupFile -Force
        Write-Host "         .env.local restaure depuis le backup !" -ForegroundColor Green
    } else {
        Set-Content -Path $envFile -Value $EnvTemplate -NoNewline
        Write-Host "         Template .env.local cree." -ForegroundColor Yellow
        Write-Host "         A REMPLIR avec vos cles Firebase !" -ForegroundColor Yellow
    }
    if (Test-Path $envBackupFile) { Remove-Item $envBackupFile -Force }

    # Etape 5 : npm install
    Write-Host "  [5/5] Installation des dependances (1-2 min)..." -ForegroundColor Cyan
    Push-Location $ProjectPath
    & npm install --silent 2>$null
    Pop-Location
    Write-Host "         Dependances installees." -ForegroundColor Green

    Write-Host ""
    Write-Host "  =========================================="  -ForegroundColor Green
    Write-Host "     INSTALLATION TERMINEE !"                  -ForegroundColor Green
    Write-Host "  =========================================="  -ForegroundColor Green
    Write-Host ""
    Write-Host "  Projet : $ProjectPath" -ForegroundColor White
    Write-Host ""

    # Verifier si le .env.local contient des cles remplies
    $envContent = Get-Content (Join-Path $ProjectPath ".env.local") -Raw -ErrorAction SilentlyContinue
    if ($envContent -and $envContent -match "VITE_FIREBASE_API_KEY=.+\S") {
        Write-Host "  Cles Firebase detectees - PRET A LANCER !" -ForegroundColor Green
    } else {
        Write-Host "  ATTENTION : .env.local vide - remplissez les cles Firebase" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  POUR LANCER :" -ForegroundColor Cyan
    Write-Host "  cd $ProjectPath" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
}

# ── LISTE DES BACKUPS ────────────────────────────────────────────────────

function Show-Backups {
    Write-Host ""
    if (-not (Test-Path $DriveBackup)) {
        Write-Host "  Aucun dossier de backup." -ForegroundColor Yellow
        return
    }

    $all = Get-ChildItem $DriveBackup -Filter "EstimaVRD_*.zip" | Sort-Object Name -Descending
    if ($all.Count -eq 0) {
        Write-Host "  Aucune sauvegarde." -ForegroundColor Yellow
        return
    }

    Write-Host "  Sauvegardes ($DriveBackup) :" -ForegroundColor Cyan
    Write-Host ""
    foreach ($b in $all) {
        $sz = "{0:N1} Mo" -f ($b.Length / 1MB)
        $dt = $b.Name -replace "EstimaVRD_","" -replace "\.zip","" -replace "_"," "
        Write-Host "  $dt  -  $sz" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "  Total : $($all.Count) sauvegarde(s)" -ForegroundColor DarkGray
    Write-Host ""
}

# ── BOUCLE PRINCIPALE ────────────────────────────────────────────────────

do {
    Show-Menu
    $choixMenu = Read-Host "  Votre choix"

    switch ($choixMenu) {
        "1" { Do-Backup;      Read-Host "  Appuyez sur Entree" }
        "2" { Do-Restore;     Read-Host "  Appuyez sur Entree" }
        "3" { Show-Backups;   Read-Host "  Appuyez sur Entree" }
        "4" { Do-FullInstall; Read-Host "  Appuyez sur Entree" }
        "5" { break }
        default { Write-Host "  Choix invalide." -ForegroundColor Red; Start-Sleep 1 }
    }
} while ($choixMenu -ne "5")
