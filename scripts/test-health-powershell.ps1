# PowerShell script to test health endpoints (Windows-friendly)
# AICIN - Service Health Check

$services = @(
    "orchestrator",
    "profile-analyzer",
    "content-matcher",
    "path-optimizer",
    "course-validator",
    "recommendation-builder"
)

Write-Host "Testing Cloud Run Service Health..." -ForegroundColor Cyan
Write-Host ""

foreach ($service in $services) {
    # Get service URL
    $url = gcloud run services describe $service `
        --region=us-west1 `
        --project=aicin-477004 `
        --format='value(status.url)' 2>$null

    if ([string]::IsNullOrEmpty($url)) {
        Write-Host "✗ $service`: NOT DEPLOYED" -ForegroundColor Red
        continue
    }

    $healthUrl = "$url/health"

    try {
        $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10

        if ($response.StatusCode -eq 200) {
            Write-Host "✓ $service`: HEALTHY ($url)" -ForegroundColor Green
        } else {
            Write-Host "✗ $service`: UNHEALTHY (HTTP $($response.StatusCode))" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "✗ $service`: ERROR - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Health check complete!" -ForegroundColor Cyan
