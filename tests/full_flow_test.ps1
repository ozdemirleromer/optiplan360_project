# Config
$baseUrl = "http://localhost:8080/api/v1"
$token = "" # Will be fetched

# Colors
function Print-Green ($msg) { Write-Host $msg -ForegroundColor Green }
function Print-Red ($msg) { Write-Host $msg -ForegroundColor Red }
function Print-Yellow ($msg) { Write-Host $msg -ForegroundColor Yellow }

# Login
Print-Yellow "Logging in..."
try {
     $loginBody = @{ username = "admin"; password = "optiplan360" } | ConvertTo-Json
     $loginRes = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
     $token = $loginRes.token
     Print-Green "Login Successful. Token obtained."
}
catch {
     Print-Red "Login Failed: $($_.Exception.Message)"
     exit 1
}

$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

function Run-Test-Cycle ($cycleNum) {
     Print-Yellow "`n=== TEST CYCLE $cycleNum START ==="
    
     # Random suffix to avoid unique constraint error on phone
     $rnd = Get-Random -Minimum 1000 -Maximum 9999
     $phone = "55512$($cycleNum)$($rnd)"
    
     # 1. Dashboard Stats (Initial)
     try {
          $stats = Invoke-RestMethod -Uri "$baseUrl/admin/stats" -Headers $headers
          $initialNew = $stats.orders_new
          Print-Green "Initial Stats: New Orders = $initialNew"
     }
     catch {
          Print-Red "Get Stats Failed: $($_.Exception.Message)"
     }

     # 2. Create Customer
     $custId = ""
     try {
          $custBody = @{
               name       = "Test Customer $cycleNum-$rnd"
               phone_norm = $phone
               address    = "Test Addr"
          } | ConvertTo-Json
          $cust = Invoke-RestMethod -Uri "$baseUrl/customers" -Method Post -Headers $headers -Body $custBody
          $custId = $cust.id
          Print-Green "Customer Created: $($cust.name) ($custId)"
     }
     catch {
          Print-Red "Create Customer Failed: $($_.Exception.Message)"
          exit 1
     }

     # 3. Create Order
     $orderId = ""
     try {
          $orderBody = @{
               customer_id   = $custId
               phone_norm    = $phone
               thickness_mm  = 18
               plate_w_mm    = 2100
               plate_h_mm    = 2800
               color         = "White"
               material_name = "MDF"
               parts         = @(
                    @{
                         part_group = "GOVDE"
                         boy_mm     = 1000
                         en_mm      = 500
                         adet       = 2
                         grain_code = "1-Material"
                         part_desc  = "Test Part"
                    }
               )
          } | ConvertTo-Json -Depth 5
          $order = Invoke-RestMethod -Uri "$baseUrl/orders" -Method Post -Headers $headers -Body $orderBody
          $orderId = $order.id
          Print-Green "Order Created: $($order.ts_code) ($orderId)"
     }
     catch {
          Print-Red "Create Order Failed: $($_.Exception.Message)"
     }

     if ($orderId) {
          # 4. Verify Dashboard Update
          try {
               $stats = Invoke-RestMethod -Uri "$baseUrl/admin/stats" -Headers $headers
               if ($stats.orders_new -gt $initialNew) {
                    Print-Green "Dashboard Updated: New Orders = $($stats.orders_new) (Expected > $initialNew)"
               }
               else {
                    Print-Red "Dashboard NOT Updated: New Orders = $($stats.orders_new)"
               }
          }
          catch { Print-Red "Stats Check Failed" }

          # 5. Update Order Header
          try {
               $updateBody = @{ color = "Updated Color" } | ConvertTo-Json
               $updated = Invoke-RestMethod -Uri "$baseUrl/orders/$orderId" -Method Put -Headers $headers -Body $updateBody
               if ($updated.color -eq "Updated Color") {
                    Print-Green "Header Update OK"
               }
               else {
                    Print-Red "Header Update Failed"
               }
          }
          catch { Print-Red "Header Update Error: $($_.Exception.Message)" }

          # 6. Update Parts (Full Replace)
          try {
               # Use array of 2 parts to ensure ConvertTo-Json outputs array
               $partsBody = @(
                    @{
                         part_group = "ARKALIK"
                         boy_mm     = 500
                         en_mm      = 500
                         adet       = 5
                         grain_code = "0-Material"
                    },
                    @{
                         part_group = "GOVDE"
                         boy_mm     = 200
                         en_mm      = 100
                         adet       = 1
                         grain_code = "0-Material"
                    }
               ) | ConvertTo-Json -Depth 5
            
               $res = Invoke-RestMethod -Uri "$baseUrl/orders/$orderId/parts" -Method Put -Headers $headers -Body $partsBody
            
               if ($res.parts.Count -eq 2) {
                    Print-Green "Parts Update OK (Count=2)"
               }
               else {
                    Print-Red "Parts Update Verify Failed (Count=$($res.parts.Count))"
               }
          }
          catch { 
               Print-Red "Parts Update Error: $($_.Exception.Message)"
               # Try to read detail
               $stream = $_.Exception.Response.GetResponseStream()
               if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    Write-Host $reader.ReadToEnd()
               }
          }
        
          # 7. Print Page Check (Backend Get)
          try {
               $o = Invoke-RestMethod -Uri "$baseUrl/orders/$orderId" -Headers $headers
               Print-Green "Get Order (for Print) OK"
          }
          catch { Print-Red "Get Order Error" }

          # 8. Delete Order
          try {
               Invoke-RestMethod -Uri "$baseUrl/orders/$orderId" -Method Delete -Headers $headers | Out-Null
               # Check if deleted
               try {
                    Invoke-RestMethod -Uri "$baseUrl/orders/$orderId" -Headers $headers
                    Print-Red "Order Delete FAILED (Still exists)"
               }
               catch {
                    Print-Green "Order Deleted (Verified 404)"
               }
          }
          catch { 
               Print-Red "Delete Order Request Error: $($_.Exception.Message)"
               $stream = $_.Exception.Response.GetResponseStream()
               if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    Write-Host $reader.ReadToEnd()
               }
          }
     }

     # 9. Delete Customer
     if ($custId) {
          try {
               Invoke-RestMethod -Uri "$baseUrl/customers/$custId" -Method Delete -Headers $headers | Out-Null
               Print-Green "Customer Deleted"
          }
          catch { Print-Red "Delete Customer Error" }
     }
    
     Print-Yellow "=== TEST CYCLE $cycleNum END ==="
}

# Run 3 Times
Run-Test-Cycle 1
Start-Sleep -Seconds 1
Run-Test-Cycle 2
Start-Sleep -Seconds 1
Run-Test-Cycle 3

Print-Green "`nALL 3 CYCLES COMPLETED."
