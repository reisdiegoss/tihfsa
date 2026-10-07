<#
.SYNOPSIS
    Instalador da Autoridade Certificadora Raiz TIHFSA (Hotel Fasano Salvador)
.DESCRIPTION
    Instala o certificado 'tihfsa-ca.crt' no repositório de Autoridades Raiz Confiáveis
    (Cert:\LocalMachine\Root) do Windows para validar conexões HTTPS seguras em https://fassa29/.
    Compatível com execução direta e automação via GPO / Logon Script.
#>

param(
    [string]$ServerHost = "fassa29",
    [string]$ServerIp = "192.168.168.29"
)

# 1. Validação de privilégios de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Este script necessita de privilégios de Administrador."
    Write-Warning "Reinicie o console PowerShell como Administrador e execute novamente."
    Exit 1
}

# 2. Localização do arquivo do certificado
$certName = "tihfsa-ca.crt"
$certCandidatePaths = @(
    (Join-Path $PSScriptRoot $certName),
    (Join-Path (Split-Path $PSScriptRoot -Parent) "cert\$certName"),
    (Join-Path $env:TEMP $certName)
)

$targetCert = $null
foreach ($p in $certCandidatePaths) {
    if (Test-Path $p) {
        $targetCert = $p
        break
    }
}

# Se não estiver local, baixa do servidor Nginx
if (-not $targetCert) {
    Write-Host "Baixando certificado do servidor $ServerHost..." -ForegroundColor Cyan
    $tempFile = Join-Path $env:TEMP $certName
    $downloadUrls = @(
        "http://$ServerHost/cert/$certName",
        "http://$ServerIp/cert/$certName"
    )

    $downloaded = $false
    foreach ($url in $downloadUrls) {
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $url -OutFile $tempFile -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            $targetCert = $tempFile
            $downloaded = $true
            break
        } catch {
            # Tenta a próxima URL
        }
    }

    if (-not $downloaded) {
        Write-Error "Não foi possível baixar o certificado de $ServerHost ou $ServerIp."
        Exit 1
    }
}

# 3. Instalação na Loja de Certificados Raiz Confiáveis
try {
    $certObj = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($targetCert)
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store([System.Security.Cryptography.X509Certificates.StoreName]::Root, [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine)
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $store.Add($certObj)
    $store.Close()

    Write-Host "=====================================================================" -ForegroundColor Green
    Write-Host "  [SUCESSO] Certificado Raiz TIHFSA instalado com sucesso!" -ForegroundColor Green
    Write-Host "=====================================================================" -ForegroundColor Green
    Write-Host "Edge e Chrome agora confiam na conexão segura https://$ServerHost/" -ForegroundColor Cyan
    Write-Host "Subject: $($certObj.Subject)"
    Write-Host "Thumbprint: $($certObj.Thumbprint)"
    Write-Host "=====================================================================" -ForegroundColor Green
} catch {
    Write-Error "Falha ao instalar o certificado na loja do Windows: $_"
    Exit 1
}
