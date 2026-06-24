# PowerShell Sync Script for both Realand RAMS databases to Web Dashboard
# Location: C:\RAMS\sync.ps1

$ErrorActionPreference = "Stop"

# --- CONFIGURATION ---
$apiUrl = "https://timetracker.actionfi.com/api/sync/attendance"
$apiKey = "07ee1ea2ba4c66893948c2a68fb3086f5411e10fe528a2bd"
$logFile = "C:\RAMS\sync-log.txt"

$databases = @(
    @{
        Name          = "Office 1 (C:\RAMS)"
        DbPath        = "C:\RAMS\Database\RAS.mdb"
        WatermarkFile = "C:\RAMS\sync-watermark.txt"
        HasAction     = $true
        Place         = "Office 1 Entrance"
    },
    @{
        Name          = "Office 2 (D:\RIMS)"
        DbPath        = "D:\RIMS\Database\RAS.mdb"
        WatermarkFile = "C:\RAMS\sync-watermark-rims.txt"
        HasAction     = $false
        Place         = "Office 2 Entrance"
    }
)
# ---------------------

function Write-Log($message, $level = "INFO") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$level] $message"
    Write-Host $logLine
    Add-Content -Path $logFile -Value $logLine -ErrorAction SilentlyContinue
}

function Process-HistoricalSyncJobs {
    Write-Log "Checking for pending historical sync jobs..."
    $headers = @{
        "Content-Type" = "application/json"
        "x-api-key"    = $apiKey
    }

    $jobId = $null
    try {
        $jobUrl = "$($apiUrl.Replace('/api/sync/attendance', '/api/sync/attendance-jobs'))"
        $jobRes = Invoke-RestMethod -Uri $jobUrl -Method Get -Headers $headers -TimeoutSec 30
        
        if (-not $jobRes.success -or $jobRes.job -eq $null) {
            Write-Log "No pending historical sync jobs found."
            return
        }

        $job = $jobRes.job
        $jobId = $job.id
        $rangeType = $job.rangeType
        $startDate = $job.startDate
        $endDate = $job.endDate

        Write-Log "Processing historical sync job: $jobId (Range: $rangeType, Start: $startDate, End: $endDate)..."

        # Update status to PROCESSING
        $payload = @{
            jobId = $jobId
            status = "PROCESSING"
        } | ConvertTo-Json
        Invoke-RestMethod -Uri $jobUrl -Method Post -Body $payload -Headers $headers -TimeoutSec 30 | Out-Null

        # Compute date limits
        $today = Get-Date
        $startLimit = $null
        $endLimit = $null

        if ($rangeType -eq "7days") {
            $startLimit = $today.AddDays(-7).ToString("yyyy-MM-dd 00:00:00")
            $endLimit = $today.ToString("yyyy-MM-dd 23:59:59")
        } elseif ($rangeType -eq "30days") {
            $startLimit = $today.AddDays(-30).ToString("yyyy-MM-dd 00:00:00")
            $endLimit = $today.ToString("yyyy-MM-dd 23:59:59")
        } elseif ($rangeType -eq "3months") {
            $startLimit = $today.AddMonths(-3).ToString("yyyy-MM-dd 00:00:00")
            $endLimit = $today.ToString("yyyy-MM-dd 23:59:59")
        } elseif ($rangeType -eq "6months") {
            $startLimit = $today.AddMonths(-6).ToString("yyyy-MM-dd 00:00:00")
            $endLimit = $today.ToString("yyyy-MM-dd 23:59:59")
        } elseif ($rangeType -eq "custom") {
            $startLimit = [DateTime]::Parse($startDate).ToString("yyyy-MM-dd 00:00:00")
            $endLimit = [DateTime]::Parse($endDate).ToString("yyyy-MM-dd 23:59:59")
        } elseif ($rangeType -eq "beginning") {
            $startLimit = $null
            $endLimit = $null
        }

        # Run sync for each DB
        $summary = @{}

        foreach ($dbConfig in $databases) {
            $dbName = $dbConfig.Name
            $dbPath = $dbConfig.DbPath
            $hasAction = $dbConfig.HasAction
            $placeName = $dbConfig.Place
            $devId = if ($hasAction) { "1" } else { "2" }
            $devKey = if ($hasAction) { "office1" } else { "office2" }

            Write-Log "Syncing historical range for $dbName..."
            
            if (-not (Test-Path $dbPath)) {
                $summary[$devKey] = @{
                    status = "failed"
                    error = "Database file not found at $dbPath"
                }
                continue
            }

            $conn = $null
            try {
                $connStr = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$dbPath;Jet OLEDB:Database Password=ras258;"
                $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
                $conn.Open()

                # Load depts
                $deptMap = @{}
                try {
                    $cmd = $conn.CreateCommand()
                    $cmd.CommandText = "SELECT DeptId, DeptName FROM ras_Dept"
                    $reader = $cmd.ExecuteReader()
                    while ($reader.Read()) {
                        $deptMap[$reader["DeptId"].ToString()] = $reader["DeptName"].ToString()
                    }
                    $reader.Close()
                } catch {}

                # Load users
                $userMap = @{}
                $cmd = $conn.CreateCommand()
                $cmd.CommandText = "SELECT DIN, UserName, DeptId FROM ras_Users"
                $reader = $cmd.ExecuteReader()
                while ($reader.Read()) {
                    $din = $reader["DIN"].ToString()
                    $name = if ($reader["UserName"] -ne [System.DBNull]::Value) { $reader["UserName"].ToString() } else { "Employee $din" }
                    $deptId = if ($reader["DeptId"] -ne [System.DBNull]::Value) { $reader["DeptId"].ToString() } else { "" }
                    $deptName = if ($deptMap.ContainsKey($deptId)) { $deptMap[$deptId] } else { "" }
                    $userMap[$din] = @{ Name = $name; Dept = $deptName }
                }
                $reader.Close()

                # Build query based on date range
                $sql = "SELECT DIN, Clock, VerifyMode"
                if ($hasAction) { $sql += ", Action" } else { $sql += ", AttTypeId" }
                $sql += " FROM ras_AttRecord WHERE DIN <> 0"

                if ($startLimit) {
                    $sql += " AND Clock >= #$startLimit#"
                }
                if ($endLimit) {
                    $sql += " AND Clock <= #$endLimit#"
                }
                $sql += " ORDER BY ID ASC"

                $cmd.CommandText = $sql
                $reader = $cmd.ExecuteReader()
                $logs = New-Object System.Collections.Generic.List[System.Collections.Hashtable]

                while ($reader.Read()) {
                    $din = $reader["DIN"].ToString().Trim()
                    if ($din -eq "0") { continue }
                    
                    $clockVal = $reader["Clock"]
                    if ($clockVal -eq [System.DBNull]::Value) { continue }
                    $clock = [DateTime]$clockVal

                    $verifyModeVal = $reader["VerifyMode"]
                    $verifyMode = if ($verifyModeVal -ne [System.DBNull]::Value) { [int]$verifyModeVal } else { 0 }

                    # Type
                    $attType = "Normal Open"
                    if ($hasAction) {
                        $actionVal = $reader["Action"]
                        $action = if ($actionVal -ne [System.DBNull]::Value) { [int]$actionVal } else { 0 }
                        if ($action -eq 0) { $attType = "Check In" }
                        elseif ($action -eq 1) { $attType = "Check Out" }
                    } else {
                        $attTypeIdVal = $reader["AttTypeId"]
                        $attTypeId = if ($attTypeIdVal -ne [System.DBNull]::Value) { $attTypeIdVal.ToString().Trim() } else { "" }
                        if ($attTypeId -eq "H05") { $attType = "Check In" }
                        elseif ($attTypeId -eq "H06") { $attType = "Check Out" }
                    }

                    # MOC
                    $verifyMoc = "Fingerprint"
                    if ($verifyMode -eq 2) { $verifyMoc = "Card" }
                    elseif ($verifyMode -eq 3 -or $verifyMode -eq 15 -or $verifyMode -eq 40) { $verifyMoc = "Face" }

                    $name = if ($userMap.ContainsKey($din)) { $userMap[$din].Name } else { "Employee $din" }
                    $dept = if ($userMap.ContainsKey($din)) { $userMap[$din].Dept } else { "" }

                    $logs.Add(@{
                        enrollId = $din
                        scannerUserId = $din
                        name = $name
                        dept = $dept
                        date = $clock.ToString("yyyy-MM-dd")
                        time = $clock.ToString("HH:mm:ss")
                        attType = $attType
                        verifyMoc = $verifyMoc
                        deviceId = $devId
                        place = $placeName
                        remark = "Success"
                    })
                }
                $reader.Close()
                $conn.Close()

                Write-Log "Found $($logs.Count) historical records for $dbName."

                # Upload logs in batches
                $insertedCount = 0
                if ($logs.Count -gt 0) {
                    $batchSize = 200
                    for ($i = 0; $i -lt $logs.Count; $i += $batchSize) {
                        $end = [Math]::Min($i + $batchSize, $logs.Count)
                        $batch = @($logs)[$i..($end - 1)]
                        
                        $payloadBatch = @{ logs = $batch } | ConvertTo-Json -Depth 5
                        $uploadRes = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $payloadBatch -Headers $headers -TimeoutSec 30
                        if ($uploadRes.success) {
                            $insertedCount += [int]$uploadRes.count
                        } else {
                            throw "Batch upload failed: $($uploadRes.error)"
                        }
                    }
                }

                $summary[$devKey] = @{
                    status = "success"
                    totalFetched = $logs.Count
                    inserted = $insertedCount
                }
            } catch {
                Write-Log "Failed to sync historical DB $($dbName): $_" "ERROR"
                $summary[$devKey] = @{
                    status = "failed"
                    error = $_.ToString()
                }
                if ($conn -and $conn.State -eq [System.Data.ConnectionState]::Open) { $conn.Close() }
            }
        }

        # Update SyncJob status to COMPLETED
        $payload = @{
            jobId = $jobId
            status = "COMPLETED"
            result = $summary
        } | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri $jobUrl -Method Post -Body $payload -Headers $headers -TimeoutSec 30 | Out-Null
        Write-Log "Historical sync job $jobId completed successfully."

    } catch {
        Write-Log "Error processing historical sync job: $_" "ERROR"
        if ($jobId) {
            try {
                $payload = @{
                    jobId = $jobId
                    status = "FAILED"
                    error = $_.ToString()
                } | ConvertTo-Json
                Invoke-RestMethod -Uri $jobUrl -Method Post -Body $payload -Headers $headers -TimeoutSec 30 | Out-Null
            } catch {}
        }
    }
}

Write-Log "=========================================="
Write-Log "Starting dual-database biometric sync process..."

try {
    Process-HistoricalSyncJobs
} catch {
    Write-Log "Failed to run historical sync jobs: $_" "WARN"
}

# Trigger Biometric Sync Polling and Pushing
if (Test-Path "C:\RAMS\sync-biometrics.ps1") {
    Write-Log "Triggering Biometric sync polling script..."
    $oldDir = Get-Location
    try {
        & "C:\RAMS\sync-biometrics.ps1"
    } catch {
        Write-Log "Error running biometric sync script: $_" "WARN"
    } finally {
        Set-Location $oldDir
    }
}

# Trigger RAMS polling for Office 1 before starting database sync
if (Test-Path "C:\RAMS\poll-rams.ps1") {
    Write-Log "Triggering RAMS headless scanner poll..."
    $oldDir = Get-Location
    try {
        & "C:\RAMS\poll-rams.ps1"
    } catch {
        Write-Log "Error running RAMS poll script: $_" "WARN"
    } finally {
        Set-Location $oldDir
    }
}

# Trigger RIMS polling for Office 2 before starting database sync
if (Test-Path "D:\RIMS\poll-rims.ps1") {
    Write-Log "Triggering RIMS headless scanner poll..."
    $oldDir = Get-Location
    try {
        & "D:\RIMS\poll-rims.ps1"
    } catch {
        Write-Log "Error running RIMS poll script: $_" "WARN"
    } finally {
        Set-Location $oldDir
    }
}

foreach ($dbConfig in $databases) {
    $dbName = $dbConfig.Name
    $dbPath = $dbConfig.DbPath
    $watermarkFile = $dbConfig.WatermarkFile
    $hasAction = $dbConfig.HasAction
    $placeName = $dbConfig.Place

    Write-Log "--- Syncing database: $dbName ---"
    $conn = $null

    try {
        # 1. Check if database exists
        if (-not (Test-Path $dbPath)) {
            Write-Log "Database file not found at $dbPath. Skipping..." "WARN"
            continue
        }

        # 2. Get last synced ID (watermark)
        $lastId = 0
        if (Test-Path $watermarkFile) {
            $content = Get-Content -Path $watermarkFile -Raw
            if ([int]::TryParse($content.Trim(), [ref]$lastId)) {
                Write-Log "Watermark found. Syncing records with ID > $lastId"
            } else {
                $lastId = 0
                Write-Log "Watermark file corrupted or empty. Defaulting to ID > 0"
            }
        } else {
            Write-Log "No watermark file found. Syncing all historical records."
        }

        # 3. Connect using 32-bit OleDb
        $connStr = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$dbPath;Jet OLEDB:Database Password=ras258;"
        $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
        $conn.Open()
        Write-Log "Connected successfully."

        # 4. Fetch departments mapping
        $deptMap = @{}
        try {
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = "SELECT DeptId, DeptName FROM ras_Dept"
            $reader = $cmd.ExecuteReader()
            while ($reader.Read()) {
                $deptId = $reader["DeptId"].ToString()
                $deptName = $reader["DeptName"].ToString()
                $deptMap[$deptId] = $deptName
            }
            $reader.Close()
        } catch {
            Write-Log "Failed to load departments mapping: $_" "WARN"
        }

        # 5. Fetch users mapping
        $userMap = @{}
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT DIN, UserName, DeptId FROM ras_Users"
        $reader = $cmd.ExecuteReader()
        while ($reader.Read()) {
            $din = $reader["DIN"].ToString()
            $name = if ($reader["UserName"] -ne [System.DBNull]::Value) { $reader["UserName"].ToString() } else { "Employee $din" }
            $deptId = if ($reader["DeptId"] -ne [System.DBNull]::Value) { $reader["DeptId"].ToString() } else { "" }
            $deptName = if ($deptMap.ContainsKey($deptId)) { $deptMap[$deptId] } else { "" }

            $userMap[$din] = @{
                Name = $name
                Dept = $deptName
            }
        }
        $reader.Close()
        Write-Log "Loaded $($userMap.Count) user profiles."

        # 6. Fetch new attendance records within the last 6 months
        $sixMonthsAgo = (Get-Date).AddMonths(-6).ToString("yyyy-MM-dd 00:00:00")
        if ($hasAction) {
            $cmd.CommandText = "SELECT ID, DIN, Clock, VerifyMode, Action FROM ras_AttRecord WHERE ID > $lastId AND Clock >= #$sixMonthsAgo# ORDER BY ID ASC"
        } else {
            $cmd.CommandText = "SELECT ID, DIN, Clock, VerifyMode, AttTypeId FROM ras_AttRecord WHERE ID > $lastId AND Clock >= #$sixMonthsAgo# ORDER BY ID ASC"
        }
        
        $reader = $cmd.ExecuteReader()
        $newLogs = New-Object System.Collections.Generic.List[System.Collections.Hashtable]
        $maxId = $lastId

        while ($reader.Read()) {
            $id = [int]$reader["ID"]
            if ($id -gt $maxId) {
                $maxId = $id
            }

            $din = $reader["DIN"].ToString().Trim()
            if ($din -eq "0") {
                continue
            }
            $clockVal = $reader["Clock"]

            
            if ($clockVal -eq [System.DBNull]::Value) {
                continue
            }
            $clock = [DateTime]$clockVal

            $verifyModeVal = $reader["VerifyMode"]
            $verifyMode = if ($verifyModeVal -ne [System.DBNull]::Value) { [int]$verifyModeVal } else { 0 }

            # Map Action to attType
            $attType = "Normal Open"
            if ($hasAction) {
                $actionVal = $reader["Action"]
                $action = if ($actionVal -ne [System.DBNull]::Value) { [int]$actionVal } else { 0 }
                if ($action -eq 0) { $attType = "Check In" }
                elseif ($action -eq 1) { $attType = "Check Out" }
            } else {
                # For databases without Action column, check AttTypeId
                $attTypeIdVal = $reader["AttTypeId"]
                $attTypeId = if ($attTypeIdVal -ne [System.DBNull]::Value) { $attTypeIdVal.ToString().Trim() } else { "" }
                
                # AttTypeId H01 = Attend, H05 = Clock-in, H06 = Clock-out
                if ($attTypeId -eq "H05") { $attType = "Check In" }
                elseif ($attTypeId -eq "H06") { $attType = "Check Out" }
                elseif ($attTypeId -eq "H11") { $attType = "Normal Open" }
                elseif ($attTypeId -eq "H12") { $attType = "Button Open" }
            }

            # Map VerifyMode to verifyMoc:
            # Under some systems (e.g. RIMS), Fingerprint could be 0, 10, etc. Face could be 3, 15, 40 etc.
            $verifyMoc = "Fingerprint"
            if ($verifyMode -eq 2) { 
                $verifyMoc = "Card" 
            } elseif ($verifyMode -eq 3 -or $verifyMode -eq 15 -or $verifyMode -eq 40) { 
                $verifyMoc = "Face" 
            } elseif ($verifyMode -eq 10) {
                $verifyMoc = "Button/Password"
            }

            $name = if ($userMap.ContainsKey($din)) { $userMap[$din].Name } else { "Employee $din" }
            $dept = if ($userMap.ContainsKey($din)) { $userMap[$din].Dept } else { "" }

            $newLogs.Add(@{
                enrollId = $din
                scannerUserId = $din
                name = $name
                dept = $dept
                date = $clock.ToString("yyyy-MM-dd")
                time = $clock.ToString("HH:mm:ss")
                attType = $attType
                verifyMoc = $verifyMoc
                deviceId = if ($hasAction) { "1" } else { "2" }
                place = $placeName
                remark = "Success"
            })
        }
        $reader.Close()
        $conn.Close()

        Write-Log "Found $($newLogs.Count) new records."

        if ($newLogs.Count -gt 0) {
            # 7. Post logs to Web API in batches of 200
            $batchSize = 200
            for ($i = 0; $i -lt $newLogs.Count; $i += $batchSize) {
                $end = [Math]::Min($i + $batchSize, $newLogs.Count)
                $batch = @($newLogs)[$i..($end - 1)]
                
                Write-Log "Uploading batch ($($i + 1) to $end) to Web Server..."
                
                $payload = @{ logs = $batch } | ConvertTo-Json -Depth 5
                $headers = @{
                    "Content-Type" = "application/json"
                    "x-api-key"    = $apiKey
                }

                $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $payload -Headers $headers -TimeoutSec 30
                
                if ($response.success) {
                    Write-Log "Batch upload successful! Count of inserted records: $($response.count)"
                } else {
                    throw "Server returned error: $($response.error)"
                }
            }

            # 8. Update watermark
            Set-Content -Path $watermarkFile -Value $maxId.ToString()
            Write-Log "Watermark updated to ID: $maxId."
        } else {
            Write-Log "No new records to upload."
        }

        Write-Log "Sync complete for $dbName."

    } catch {
        Write-Log "ERROR in database ${dbName}: $_" "ERROR"
        if ($conn -and $conn.State -eq [System.Data.ConnectionState]::Open) {
            $conn.Close()
        }
    }
}

Write-Log "Biometric sync run complete."
Write-Log "=========================================="
