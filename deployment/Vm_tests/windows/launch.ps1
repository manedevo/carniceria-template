#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Carniceria Artesanal — Zero-touch Windows VM launcher.
    Installs Chocolatey, a hypervisor (VirtualBox or detects VMware),
    Vagrant, and any required plugins, then starts the test VM.
    No prior software needed — just run launch.bat.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Output helpers ─────────────────────────────────────────────────────────────
function Write-Info  { param([string]$msg) Write-Host "[INFO]  $msg" -ForegroundColor Green  }
function Write-Warn  { param([string]$msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$msg) Write-Host "[ERROR] $msg" -ForegroundColor Red    }
function Write-Step  { param([string]$msg) Write-Host "`n==  $msg" -ForegroundColor Cyan     }

function Refresh-Path {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Find-Exe {
    param([string]$name, [string[]]$extraPaths = @())
    $found = Get-Command $name -ErrorAction SilentlyContinue
    if ($found) { return $found.Source }
    foreach ($p in $extraPaths) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

# ── Banner ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Carniceria Artesanal  --  VM Setup        " -ForegroundColor Cyan
Write-Host "  Windows fully-automatic launcher          " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── Paths ──────────────────────────────────────────────────────────────────────
$SCRIPT_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path
$VAGRANT_DIR = (Resolve-Path (Join-Path $SCRIPT_DIR "..")).Path   # deployment/Vm_tests/


#############################################################
##### 1. Install Chocolatey (Windows package manager)
#############################################################

Write-Step "Step 1 — Chocolatey"

$choco = Find-Exe "choco" @("C:\ProgramData\chocolatey\bin\choco.exe")
if ($choco) {
    Write-Info "Chocolatey already installed: $choco"
} else {
    Write-Info "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = `
        [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression (
        (New-Object System.Net.WebClient).DownloadString(
            'https://community.chocolatey.org/install.ps1'
        )
    )
    Refresh-Path
    $choco = Find-Exe "choco" @("C:\ProgramData\chocolatey\bin\choco.exe")
    if (-not $choco) { Write-Err "Chocolatey installation failed."; exit 1 }
    Write-Info "Chocolatey installed."
}


#############################################################
##### 2. Detect or install hypervisor
#############################################################

Write-Step "Step 2 — Hypervisor"

$vmwareExePaths = @(
    "C:\Program Files (x86)\VMware\VMware Workstation\vmrun.exe",
    "C:\Program Files\VMware\VMware Workstation\vmrun.exe"
)
$vboxExePaths = @(
    "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
)

$hasVMware = ($vmwareExePaths | Where-Object { Test-Path $_ }).Count -gt 0
$hasVBox   = (Find-Exe "VBoxManage" $vboxExePaths) -ne $null

if ($hasVMware) {
    $PROVIDER = "vmware_desktop"
    Write-Info "VMware Workstation detected — will use vmware_desktop provider."
} elseif ($hasVBox) {
    $PROVIDER = "virtualbox"
    Write-Info "VirtualBox detected — will use virtualbox provider."
} else {
    Write-Info "No hypervisor found. Installing VirtualBox via Chocolatey..."
    & $choco install virtualbox -y --no-progress
    Refresh-Path
    $vboxExe = Find-Exe "VBoxManage" $vboxExePaths
    if (-not $vboxExe) {
        Write-Err "VirtualBox installation failed. Install it manually from https://www.virtualbox.org"
        exit 1
    }
    Write-Info "VirtualBox installed."
    $PROVIDER = "virtualbox"
}


#############################################################
##### 3. Install Vagrant
#############################################################

Write-Step "Step 3 — Vagrant"

$vagrantExePaths = @(
    "C:\Program Files\HashiCorp\Vagrant\bin\vagrant.exe",
    "C:\HashiCorp\Vagrant\bin\vagrant.exe"
)
$vagrant = Find-Exe "vagrant" $vagrantExePaths

if ($vagrant) {
    $vagrantVersion = & $vagrant --version 2>$null
    Write-Info "Vagrant already installed: $vagrantVersion"
} else {
    Write-Info "Installing Vagrant via Chocolatey..."
    & $choco install vagrant -y --no-progress
    Refresh-Path
    $vagrant = Find-Exe "vagrant" $vagrantExePaths
    if (-not $vagrant) {
        Write-Err "Vagrant installation failed. Install it manually from https://www.vagrantup.com/downloads"
        exit 1
    }
    Write-Info "Vagrant installed: $(& $vagrant --version 2>$null)"
    Write-Warn "A system restart may be required for Vagrant to work fully."
    Write-Warn "If the VM fails to start, restart your PC and re-run this launcher."
}


#############################################################
##### 4. Install vagrant-vmware-desktop plugin (VMware only)
#############################################################

if ($PROVIDER -eq "vmware_desktop") {
    Write-Step "Step 4 — VMware Vagrant plugin"

    $plugins = & $vagrant plugin list 2>$null
    if ($plugins -match "vagrant-vmware-desktop") {
        Write-Info "vagrant-vmware-desktop plugin already installed."
    } else {
        Write-Info "Installing vagrant-vmware-desktop plugin (one-time setup)..."
        & $vagrant plugin install vagrant-vmware-desktop
        Write-Info "Plugin installed."
    }
} else {
    Write-Info "Skipping VMware plugin (not needed for $PROVIDER)."
}


#############################################################
##### 5. Start the VM
#############################################################

Write-Step "Step 5 — Starting the VM"

Write-Info "Vagrant directory: $VAGRANT_DIR"
Write-Info "Provider: $PROVIDER"
Write-Info "Running: vagrant up --provider=$PROVIDER"
Write-Info "(First boot takes 15-20 minutes — please wait)"
Write-Host ""

Set-Location $VAGRANT_DIR
$env:VAGRANT_DEFAULT_PROVIDER = $PROVIDER

try {
    & $vagrant up --provider=$PROVIDER
} catch {
    Write-Err "vagrant up failed: $_"
    exit 1
}


#############################################################
##### Done
#############################################################

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  VM is ready!                              " -ForegroundColor Green
Write-Host "  Open in your browser:                     " -ForegroundColor Green
Write-Host "  http://localhost:8080                     " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Info "Useful commands (run from deployment/Vm_tests/):"
Write-Host "  vagrant halt        -- stop the VM"
Write-Host "  vagrant up          -- start the VM again"
Write-Host "  vagrant ssh         -- open a shell inside the VM"
Write-Host "  vagrant destroy -f  -- delete the VM completely"
Write-Host ""
