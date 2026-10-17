$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
foreach ($taskName in @('backend', 'frontend')) {
    $taskPidFile = Join-Path $taskRoot ".runtime/$taskName.pid"
    if (-not (Test-Path -LiteralPath $taskPidFile)) { continue }
    $taskProcessId = [int](Get-Content -LiteralPath $taskPidFile -Raw)
    $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
    if ($null -eq $taskProcess) { continue }
    $taskExpectedRunner = Join-Path $PSScriptRoot "local_$taskName.py"
    if ($taskProcess.CommandLine -and $taskProcess.CommandLine.Contains($taskExpectedRunner)) {
        Stop-Process -Id $taskProcessId
        Write-Output "Stopped GameBuddy $taskName ($taskProcessId)."
    } else {
        Write-Warning "PID $taskProcessId no longer belongs to GameBuddy; left untouched."
    }
}
