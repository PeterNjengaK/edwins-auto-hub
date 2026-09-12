param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
try {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $nodeCommand = Get-Command node -ErrorAction Stop
    $nodeMajor = [int]((& $nodeCommand.Source -p 'parseInt(process.versions.node)'))
    if ($nodeMajor -lt 24) { throw 'Install Node.js 24 or newer, then try again.' }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/lucide'))) {
        throw 'Run npm.cmd install in the project folder once, then open Start-Admin.cmd again.'
    }
    $envFile = Join-Path $projectRoot '.env'
    $portValue = '3000'
    if (Test-Path -LiteralPath $envFile) { $portValue = & $nodeCommand.Source "--env-file=$envFile" -p "process.env.PORT || '3000'" }
    $port = [int]$portValue
    if ($port -lt 1 -or $port -gt 65535) { throw 'PORT must be between 1 and 65535.' }
    $baseUrl = "http://127.0.0.1:$port"
    $health = $null
    try { $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 2 } catch {}
    if ($health -and $health.app -ne 'edwins-auto-hub') { throw "Another service is using port $port. Choose a different PORT in .env." }
    if (-not $health) {
        $storagePath = Join-Path $projectRoot 'backend/storage'
        New-Item -ItemType Directory -Force -Path $storagePath | Out-Null
        $serverPath = Join-Path $projectRoot 'backend/server.js'
        $process = Start-Process -FilePath $nodeCommand.Source -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $storagePath 'server.log') -RedirectStandardError (Join-Path $storagePath 'server-error.log') -PassThru
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            Start-Sleep -Milliseconds 300
            try { $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 1; if ($health.app -eq 'edwins-auto-hub') { break } } catch {}
            if ($process.HasExited) { break }
        }
        if (-not $health -or $health.app -ne 'edwins-auto-hub') { throw 'The server did not start. Check backend/storage/server-error.log.' }
    }
    if (-not $NoBrowser) { Start-Process "$baseUrl/admin/" }
    Write-Host "Edwin's Manager is running at $baseUrl/admin/"
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
