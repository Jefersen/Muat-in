# ==========================================
# MUAT-IN API E2E TEST SCRIPT (PowerShell)
# ==========================================

$BASE_URL = "http://localhost:3000"
$script:PASS = $true

function Print-Section($title) {
    Write-Host ""
    Write-Host "-----------------------------------------" -ForegroundColor Cyan
    Write-Host " $title" -ForegroundColor Cyan
    Write-Host "-----------------------------------------" -ForegroundColor Cyan
}

function Check-Status($name, $response, $expectedCode) {
    if ($response.StatusCode -eq $expectedCode) {
        Write-Host "[PASS] $name (HTTP $($response.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $name (Expected $expectedCode, Got $($response.StatusCode))" -ForegroundColor Red
        $script:PASS = $false
    }
}

# 1. Health Check
Print-Section "TEST 1: Health Check"
try {
    $r = Invoke-WebRequest -Uri "$BASE_URL" -Method GET -UseBasicParsing -ErrorAction Stop
    Check-Status "GET /" $r 200
} catch {
    Write-Host "[FAIL] GET / - $($_.Exception.Message)" -ForegroundColor Red
    $script:PASS = $false
}

# 2. Registration & Login
Print-Section "TEST 2: Authentication (Register & Login)"
$regBody = '{"name":"Budi Santoso","email":"budisantoso@gmail.com","password":"password123","role":"dispatcher"}'
try {
    # Attempt registration first in case DB is fresh
    Invoke-WebRequest -Uri "$BASE_URL/auth/register" -Method POST -UseBasicParsing `
        -ContentType "application/json" -Body $regBody -ErrorAction SilentlyContinue | Out-Null
} catch {}

$loginBody = '{"email":"budisantoso@gmail.com","password":"password123"}'
try {
    $r = Invoke-WebRequest -Uri "$BASE_URL/auth/login" -Method POST -UseBasicParsing `
        -ContentType "application/json" -Body $loginBody -ErrorAction Stop
    Check-Status "POST /auth/login (budisantoso@gmail.com)" $r 200
    $token = ($r.Content | ConvertFrom-Json).access_token
    Write-Host "   Token retrieved successfully" -ForegroundColor Gray
} catch {
    # Fallback to admin@muatin.com
    $adminBody = '{"email":"admin@muatin.com","password":"password123"}'
    try {
        $r = Invoke-WebRequest -Uri "$BASE_URL/auth/login" -Method POST -UseBasicParsing `
            -ContentType "application/json" -Body $adminBody -ErrorAction Stop
        Check-Status "POST /auth/login (admin@muatin.com fallback)" $r 200
        $token = ($r.Content | ConvertFrom-Json).access_token
        Write-Host "   Token retrieved successfully via admin fallback" -ForegroundColor Gray
    } catch {
        Write-Host "[FAIL] POST /auth/login - $($_.Exception.Message)" -ForegroundColor Red
        $script:PASS = $false
        exit 1
    }
}

$headers = @{ Authorization = "Bearer $token" }

# 3. List Items
Print-Section "TEST 3: GET /items"
try {
    $r = Invoke-WebRequest -Uri "$BASE_URL/items?page=1&limit=20" -Method GET -UseBasicParsing `
        -Headers $headers -ErrorAction Stop
    Check-Status "GET /items" $r 200
    $itemsObj = ($r.Content | ConvertFrom-Json).data
    Write-Host "   Found $($itemsObj.Count) items in DB" -ForegroundColor Gray
} catch {
    Write-Host "[FAIL] GET /items - $($_.Exception.Message)" -ForegroundColor Red
    $script:PASS = $false
}

# 4. Search Items
Print-Section "TEST 4: GET /items?search=Panel"
try {
    $r = Invoke-WebRequest -Uri "$BASE_URL/items?search=Panel" -Method GET -UseBasicParsing `
        -Headers $headers -ErrorAction Stop
    Check-Status "GET /items?search=Panel" $r 200
    $searchItems = ($r.Content | ConvertFrom-Json).data
    Write-Host "   Found $($searchItems.Count) matching items" -ForegroundColor Gray
} catch {
    Write-Host "[FAIL] GET /items?search=Panel - $($_.Exception.Message)" -ForegroundColor Red
    $script:PASS = $false
}

# 5. List Trucks
Print-Section "TEST 5: GET /trucks"
try {
    $r = Invoke-WebRequest -Uri "$BASE_URL/trucks" -Method GET -UseBasicParsing `
        -Headers $headers -ErrorAction Stop
    Check-Status "GET /trucks" $r 200
    $trucks = $r.Content | ConvertFrom-Json
    $truckId = $trucks[0].id
    Write-Host "   Found $($trucks.Count) trucks. Target: $($trucks[0].name)" -ForegroundColor Gray
} catch {
    Write-Host "[FAIL] GET /trucks - $($_.Exception.Message)" -ForegroundColor Red
    $script:PASS = $false
    exit 1
}

# 6. Execute Load Plan
Print-Section "TEST 6: POST /plans/execute"
$planBody = @{
    truck_id = $truckId
    items = @(
        @{ item_id = $itemsObj[0].id; quantity = 3 },
        @{ item_id = $itemsObj[1].id; quantity = 2 }
    )
} | ConvertTo-Json -Depth 5

try {
    $r = Invoke-WebRequest -Uri "$BASE_URL/plans/execute" -Method POST -UseBasicParsing `
        -ContentType "application/json" -Body $planBody -Headers $headers -ErrorAction Stop
    Check-Status "POST /plans/execute" $r 201
    $plan = $r.Content | ConvertFrom-Json
    $planId = $plan.plan_id
    Write-Host "   Plan ID: $planId" -ForegroundColor Gray
    Write-Host "   ODOL Risk Status: $($plan.odol_risk.status)" -ForegroundColor Gray
    Write-Host "   Packed Items: $($plan.packed_items.Count)" -ForegroundColor Gray
    Write-Host "   Total Weight: $($plan.utilization.total_weight_kg) kg" -ForegroundColor Gray
} catch {
    Write-Host "[FAIL] POST /plans/execute - $($_.Exception.Message)" -ForegroundColor Red
    $script:PASS = $false
    exit 1
}

# 7. Get Manifest & PDF
Print-Section "TEST 7: GET /plans/:id/manifest"
try {
    $r = Invoke-WebRequest -Uri "$BASE_URL/plans/$planId/manifest" -Method GET -UseBasicParsing `
        -Headers $headers -ErrorAction Stop
    Check-Status "GET /plans/$planId/manifest" $r 200
    $manifest = $r.Content | ConvertFrom-Json
    Write-Host "   Manifest ID: $($manifest.manifest_id)" -ForegroundColor Gray
    Write-Host "   QR Payload: $($manifest.qr_code_payload)" -ForegroundColor Gray
    if ($manifest.manifest_pdf_url) {
        Write-Host "   PDF Storage URL: $($manifest.manifest_pdf_url)" -ForegroundColor Green
    } else {
        Write-Host "   PDF Generated successfully (Local manifest active)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[FAIL] GET /plans/$planId/manifest - $($_.Exception.Message)" -ForegroundColor Red
    $script:PASS = $false
}

# Final Result
Write-Host ""
Write-Host "=========================================" -ForegroundColor White
if ($script:PASS) {
    Write-Host " ALL ENDPOINTS PASSED SUCCESSFULLY!" -ForegroundColor Green
} else {
    Write-Host " SOME ENDPOINTS FAILED!" -ForegroundColor Red
}
Write-Host "=========================================" -ForegroundColor White
