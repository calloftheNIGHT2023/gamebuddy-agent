param([switch]$BackendOnly)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskState = Join-Path $taskRoot '.runtime'
New-Item -ItemType Directory -Path $taskState -Force | Out-Null
$taskPython = (Get-Command python -ErrorAction Stop).Source

function Test-TaskUrl([string]$Url) {
    try { return (Invoke-WebRequest -Uri $Url -TimeoutSec 3 -UseBasicParsing).StatusCode -eq 200 }
    catch { return $false }
}

function Start-TaskServer([string]$Name, [string]$Runner, [string]$Url) {
    if (Test-TaskUrl $Url) { Write-Output "$Name is already available: $Url"; return }
    $taskRunner = Join-Path $PSScriptRoot $Runner
    $taskProcess = Start-Process -FilePath $taskPython -ArgumentList @(('"{0}"' -f $taskRunner)) `
        -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $taskState "$Name.stdout.log") `
        -RedirectStandardError (Join-Path $taskState "$Name.stderr.log")
    Set-Content -LiteralPath (Join-Path $taskState "$Name.pid") -Value $taskProcess.Id -Encoding ascii
    for ($taskAttempt = 0; $taskAttempt -lt 15; $taskAttempt++) {
        if (Test-TaskUrl $Url) { Write-Output "$Name started in background: $Url"; return }
        if ($taskProcess.HasExited) { break }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name did not start. Inspect .runtime/$Name.stderr.log. Check whether its port is occupied."
}

Start-TaskServer 'backend' 'local_backend.py' 'http://127.0.0.1:8000/health'
if (-not $BackendOnly) {
    Start-TaskServer 'frontend' 'local_frontend.py' 'http://127.0.0.1:3000/'
}
Write-Output 'Open http://127.0.0.1:3000/assistant/ or /ops/. These processes run until stopped or Windows exits.'
