param(
    [int]$Port = 4201,
    [int]$BffPort = 8081
)

$ErrorActionPreference = 'Stop'
$previousTarget = $env:BFF_PROXY_TARGET
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    $env:BFF_PROXY_TARGET = "http://127.0.0.1:$BffPort"
    Write-Host "Frontend: http://localhost:$Port | BFF local: $env:BFF_PROXY_TARGET"
    npm start -- --port $Port
    if ($LASTEXITCODE -ne 0) { throw "Angular fallo con codigo $LASTEXITCODE" }
}
finally {
    $env:BFF_PROXY_TARGET = $previousTarget
    Pop-Location
}
