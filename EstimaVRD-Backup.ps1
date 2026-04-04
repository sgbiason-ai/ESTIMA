$ErrorActionPreference = "Stop"

$ProjectPath = "C:\Projet\Estima"
$DriveBackup = "G:\Mon Drive\EstimaVRD-Backups"
$ExcludeDirs = @("node_modules", "dist", ".claude")

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
    Write-Host "  [4] Quitter"                                 -ForegroundColor Gray
    Write-Host ""
}

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
    Write-Host ""
    Write-Host "  ATTENTION : ceci remplace le contenu de $ProjectPath" -ForegroundColor Yellow
    Write-Host "  (.env.local et node_modules seront preserves)"       -ForegroundColor Yellow
    $ok = Read-Host "  Confirmer ? (O/N)"
    if ($ok -notmatch "^[oOyY]") {
        Write-Host "  Annule." -ForegroundColor Gray
        return
    }

    Write-Host ""
    Write-Host "  Restauration en cours..." -ForegroundColor Cyan

    $envFile = Join-Path $ProjectPath ".env.local"
    $envSave = $null
    if (Test-Path $envFile) { $envSave = Get-Content $envFile -Raw }

    Get-ChildItem -Path $ProjectPath -Force | Where-Object {
        $_.Name -notin @("node_modules", ".env.local", ".claude")
    } | Remove-Item -Recurse -Force

    Write-Host "  Extraction..." -ForegroundColor DarkGray
    Expand-Archive -Path $selected.FullName -DestinationPath $ProjectPath -Force

    if ($envSave) {
        Set-Content -Path $envFile -Value $envSave -NoNewline
        Write-Host "  .env.local preserve." -ForegroundColor DarkGray
    }

    Write-Host "  npm install..." -ForegroundColor DarkGray
    Push-Location $ProjectPath
    & npm install --silent 2>$null
    Pop-Location

    Write-Host ""
    Write-Host "  RESTAURATION REUSSIE !" -ForegroundColor Green

    if (-not $envSave) {
        Write-Host ""
        Write-Host "  RAPPEL : recreez .env.local avec vos cles Firebase/Sentry" -ForegroundColor Yellow
    }
    Write-Host ""
}

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

do {
    Show-Menu
    $choixMenu = Read-Host "  Votre choix"

    switch ($choixMenu) {
        "1" { Do-Backup;  Read-Host "  Appuyez sur Entree" }
        "2" { Do-Restore; Read-Host "  Appuyez sur Entree" }
        "3" { Show-Backups; Read-Host "  Appuyez sur Entree" }
        "4" { break }
        default { Write-Host "  Choix invalide." -ForegroundColor Red; Start-Sleep 1 }
    }
} while ($choixMenu -ne "4")
