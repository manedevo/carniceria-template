# =====================================================================
#  Carniceria Artesanal — Windows VM Launcher (launch.ps1)
#  VERSION: v1.3 (StrictMode-safe, Unicode-safe, VMware/VBox fixed)
# =====================================================================

#Requires -RunAsAdministrator
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info { param([string]$msg) Write-Host "[INFO]  $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err { param([string]$msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Step { param([string]$msg) Write-Host "`n==  $msg" -ForegroundColor Cyan }

function Refresh-Path {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
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

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Carniceria Artesanal  --  VM Setup        " -ForegroundColor Cyan
Write-Host "  Windows automatic launcher                " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$VAGRANT_DIR = (Resolve-Path (Join-Path $SCRIPT_DIR "..")).Path


#############################################################
##### 1. Install Chocolatey
#############################################################

Write-Step "Step 1 - Chocolatey"

$choco = Find-Exe "choco" @("C:\ProgramData\chocolatey\bin\choco.exe")
if ($choco) {
    Write-Info "Chocolatey already installed: $choco"
}
else {
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
##### 2. Detect or install hypervisor (StrictMode-safe)
#############################################################

Write-Step "Step 2 - Hypervisor"

$vmwareExePaths = @(
    "C:\Program Files (x86)\VMware\VMware Workstation\vmrun.exe",
    "C:\Program Files\VMware\VMware Workstation\vmrun.exe"
)

$vboxExePaths = @(
    "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
)

# VMware detection (StrictMode-safe)
$vmwareFound = @($vmwareExePaths | Where-Object { Test-Path $_ })
$hasVMware = $vmwareFound.Length -gt 0

# VirtualBox detection (StrictMode-safe)
$vboxFound = Find-Exe "VBoxManage" $vboxExePaths
$hasVBox = $vboxFound -ne $null

if ($hasVMware) {
    $PROVIDER = "vmware_desktop"
    Write-Info "VMware Workstation detected."
}
elseif ($hasVBox) {
    $PROVIDER = "virtualbox"
    Write-Info "VirtualBox detected."
}
else {
    Write-Info "No hypervisor found. Installing VirtualBox..."
    & $choco install virtualbox -y --no-progress
    Refresh-Path

    $vboxExe = Find-Exe "VBoxManage" $vboxExePaths
    if (-not $vboxExe) {
        Write-Err "VirtualBox installation failed."
        exit 1
    }

    Write-Info "VirtualBox installed."
    $PROVIDER = "virtualbox"
}


#############################################################
##### 3. Install Vagrant
#############################################################

Write-Step "Step 3 - Vagrant"

$vagrantExePaths = @(
    "C:\Program Files\HashiCorp\Vagrant\bin\vagrant.exe",
    "C:\HashiCorp\Vagrant\bin\vagrant.exe"
)
$vagrant = Find-Exe "vagrant" $vagrantExePaths

if ($vagrant) {
    Write-Info "Vagrant already installed: $(& $vagrant --version)"
}
else {
    Write-Info "Installing Vagrant..."
    & $choco install vagrant -y --no-progress
    Refresh-Path
    $vagrant = Find-Exe "vagrant" $vagrantExePaths
    if (-not $vagrant) {
        Write-Err "Vagrant installation failed."
        exit 1
    }
    Write-Info "Vagrant installed."
}


#############################################################
##### 4. VMware plugin (only if needed)
#############################################################

if ($PROVIDER -eq "vmware_desktop") {
    Write-Step "Step 4 - VMware plugin"

    $plugins = & $vagrant plugin list 2>$null
    if ($plugins -match "vagrant-vmware-desktop") {
        Write-Info "VMware plugin already installed."
    }
    else {
        Write-Info "Installing VMware plugin..."
        & $vagrant plugin install vagrant-vmware-desktop
        Write-Info "Plugin installed."
    }
}
else {
    Write-Info "Skipping VMware plugin."
}


#############################################################
##### 5. Start VM
#############################################################

Write-Step "Step 5 - Starting VM"

Write-Info "Vagrant directory: $VAGRANT_DIR"
Write-Info "Provider: $PROVIDER"
Write-Info "First boot may take 15-20 minutes. Please wait."

Set-Location $VAGRANT_DIR
$env:VAGRANT_DEFAULT_PROVIDER = $PROVIDER

try {
    & $vagrant up --provider=$PROVIDER
}
catch {
    Write-Err "vagrant up failed: $_"
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  VM is ready!" -ForegroundColor Green
Write-Host "  Open: http://localhost:8080" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
