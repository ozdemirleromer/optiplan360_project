# SQL Board Test Script
$baseUrl = "http://localhost:8080/api/v1"

# Colors
function Print-Green ($msg) { Write-Host $msg -ForegroundColor Green }
function Print-Red ($msg) { Write-Host $msg -ForegroundColor Red }
function Print-Yellow ($msg) { Write-Host $msg -ForegroundColor Yellow }

# Login
Print-Yellow "Logging in..."
try {
     $loginBody = @{ username = "admin"; password = "optiplan360" } | ConvertTo-Json
     $loginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
     $token = $loginRes.token
     Print-Green "Login Successful."
}
catch {
     Print-Red "Login Failed: $($_.Exception.Message)"
     exit 1
}

$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

Print-Yellow "=== TEST SQL BOARD START ==="

# 1. Create Saved Query
$qId = ""
try {
     $body = @{
          name        = "Test Query $(Get-Random)"
          description = "Automated test query"
          sql         = "SELECT * FROM users"
     } | ConvertTo-Json
     $res = Invoke-RestMethod -Uri "$baseUrl/sql/saved" -Method Post -Headers $headers -Body $body
     $qId = $res.id
     Print-Green "Created Saved Query: $($res.name) ($qId)"
}
catch {
     Print-Red "Create Saved Query Failed: $($_.Exception.Message)"
     exit 1
}

# 2. List Saved Queries
try {
     $list = Invoke-RestMethod -Uri "$baseUrl/sql/saved" -Headers $headers
     if ($list.Count -gt 0) {
          Print-Green "List Saved Queries OK (Count=$($list.Count))"
          # Verify our query is there
          $found = $list | Where-Object { $_.id -eq $qId }
          if ($found) { Print-Green "Found created query in list." }
          else { Print-Red "Created query NOT found in list!" }
     }
     else {
          Print-Red "List is empty (Unexpected)"
     }
}
catch {
     Print-Red "List Saved Queries Failed: $($_.Exception.Message)"
}

# 3. Export Query
try {
     $exportBody = @{ sql = "SELECT * FROM users LIMIT 5" } | ConvertTo-Json
     # Invoke-WebRequest receives the file stream
     $exportRes = Invoke-WebRequest -Uri "$baseUrl/sql/export" -Method Post -Headers $headers -Body $exportBody -OutFile "test_export.xlsx"
     if (Test-Path "test_export.xlsx") {
          Print-Green "Export Query OK (File size: $((Get-Item test_export.xlsx).Length) bytes)"
          Remove-Item "test_export.xlsx"
     }
     else {
          Print-Red "Export Query Failed (File not created)"
     }
}
catch {
     Print-Red "Export Query Error: $($_.Exception.Message)"
     $stream = $_.Exception.Response.GetResponseStream()
     if ($stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          Write-Host $reader.ReadToEnd()
     }
}

# 4. Delete Saved Query
if ($qId) {
     try {
          Invoke-RestMethod -Uri "$baseUrl/sql/saved/$qId" -Method Delete -Headers $headers
          Print-Green "Deleted Saved Query"
     }
     catch {
          Print-Red "Delete Saved Query Failed: $($_.Exception.Message)"
     }
}

Print-Yellow "=== TEST SQL BOARD END ==="
