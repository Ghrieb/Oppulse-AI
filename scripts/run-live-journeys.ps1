# Runs the Playwright journeys against the local FastAPI service.
#
# The same journeys that run against the mock backend, but with the
# frontend in live mode: no MSW, no fixtures in the browser — the service
# answers every request.
#
#   pwsh scripts/run-live-journeys.ps1

$ErrorActionPreference = 'Stop'

$root = 'C:\Users\Hani\Desktop\ThirdUni\Oppulse AI'
$frontend = Join-Path $root 'frontend'
$backend = Join-Path $root 'backend'

Write-Output '--- stopping anything on the ports ---'
foreach ($port in @(5173, 8000)) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 2

Write-Output '--- seeding the demo ---'
Push-Location $backend
& uv run python scripts/seed_demo.py
Pop-Location

Write-Output '--- starting the service ---'
$backendJob = Start-Job -ScriptBlock {
    Set-Location 'C:\Users\Hani\Desktop\ThirdUni\Oppulse AI\backend'
    & uv run uvicorn app.main:app --port 8000
}

Write-Output '--- starting the frontend in live mode ---'
$frontendJob = Start-Job -ScriptBlock {
    Set-Location 'C:\Users\Hani\Desktop\ThirdUni\Oppulse AI\frontend'
    $env:VITE_API_MODE = 'live'
    $env:VITE_API_BASE_URL = 'http://localhost:8000'
    & npm.cmd run dev
}

Write-Output '--- waiting for the services ---'
$backendReady = $false
$frontendReady = $false

for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Seconds 2

    if (-not $backendReady) {
        try {
            $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 5 -UseBasicParsing
            if ($health.StatusCode -eq 200) { $backendReady = $true }
        } catch {
            # Not up yet.
        }
    }

    if (-not $frontendReady) {
        try {
            $page = Invoke-WebRequest -Uri 'http://localhost:5173' -TimeoutSec 5 -UseBasicParsing
            if ($page.StatusCode -eq 200) { $frontendReady = $true }
        } catch {
            # Not up yet.
        }
    }

    if ($backendReady -and $frontendReady) { break }
}

if (-not ($backendReady -and $frontendReady)) {
    Write-Output "The services did not start (backend: $backendReady, frontend: $frontendReady)."
    Write-Output 'Backend log:'
    Receive-Job $backendJob -Keep | Select-Object -Last 20
    Write-Output 'Frontend log:'
    Receive-Job $frontendJob -Keep | Select-Object -Last 20
    Stop-Job $backendJob, $frontendJob
    Remove-Job $backendJob, $frontendJob -Force
    exit 1
}

Write-Output '--- running the journeys against the live service ---'
Push-Location $frontend
$env:LIVE = '1'
$spec = if ($args.Count -gt 0) { $args[0] } else { 'e2e/live.spec.ts' }
& npx playwright test $spec
$status = $LASTEXITCODE
Pop-Location

Write-Output '--- stopping the services ---'
Stop-Job $backendJob, $frontendJob
Remove-Job $backendJob, $frontendJob -Force

exit $status
