# import_rams_historical.ps1 — One-off historical recovery script for Office 1
# Pulls all attendance records from the device and inserts missing ones into C:\RAMS\Database\RAS.mdb

$ErrorActionPreference = "Stop"

# --- CONFIGURATION ---
$dllPath       = "C:\RAMS\RealandAPI.dll"
$rissDllPath   = "C:\RAMS\Riss.Devices.dll"
$dbPath        = "C:\RAMS\Database\RAS.mdb"
$dbPassword    = "ras258"
$scannerIp     = "192.168.5.61"
$scannerPort   = 5500
$scannerDN     = 2
$scannerPass   = 0
# ---------------------

Write-Host "=========================================="
Write-Host "Starting RAMS historical logs recovery..."

try {
    # 1. Load dependencies
    Set-Location "C:\RAMS"
    [System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
    [System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null
    Write-Host "DLLs loaded."

    # 2. Connect to Access database
    $connStr = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$dbPath;Jet OLEDB:Database Password=$dbPassword;"
    $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
    $conn.Open()
    Write-Host "Connected to Access database."

    # Get current max ID
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT MAX(ID) FROM ras_AttRecord"
    $maxIdResult = $cmd.ExecuteScalar()
    $currentMaxId = if ($maxIdResult -eq [System.DBNull]::Value -or $maxIdResult -eq $null) { 0 } else { [int]$maxIdResult }
    Write-Host "Current max ID: $currentMaxId"

    # 3. Create device and connect to scanner
    $device = New-Object RealandAPI.ZDC2911Finger
    $device.Communication = 1  # TCP/IP
    $device.IpAddress = $scannerIp
    $device.IpPort = $scannerPort
    $device.DN = $scannerDN
    $device.Password = $scannerPass
    Write-Host "Device configured: ${scannerIp}:${scannerPort} DN=$scannerDN"

    $opened = $device.OpenDevice()
    if (-not $opened) {
        Write-Error "Failed to open device connection!"
        $conn.Close()
        exit 1
    }
    Write-Host "Device connection opened."

    # 4. Set date range for log fetching
    $dates = New-Object 'System.Collections.Generic.List[datetime]'
    $dates.Add([DateTime]"2025-11-20")
    $dates.Add([DateTime]"2026-06-15")

    # 5. Download records using ZDC2911Finger specific methods
    Write-Host "Reading all general log data on device..."
    $readResult = $device.ReadAllGLogData($dates)
    Write-Host "ReadAllGLogData result: $readResult"

    Write-Host "Fetching records from device..."
    $records = $device.GetAllRecords($dates)
    
    # Close device connection immediately
    $device.CloseDevice() | Out-Null
    Write-Host "Device connection closed."

    if ($records -eq $null -or $records.Count -eq 0) {
        Write-Host "No records retrieved from scanner."
        $conn.Close()
        exit 0
    }

    Write-Host "Retrieved $($records.Count) records. Sorting..."
    $sortedRecords = $records | Sort-Object Clock
    $parsedCount = $sortedRecords.Count

    # Start transaction
    $transaction = $conn.BeginTransaction()
    
    # Load all existing clock records for high-speed memory deduplication
    Write-Host "Loading existing record timestamps from database..."
    $existingClocks = @{}
    $checkCmd = $conn.CreateCommand()
    $checkCmd.Transaction = $transaction
    $checkCmd.CommandText = "SELECT DIN, Clock FROM ras_AttRecord"
    $reader = $checkCmd.ExecuteReader()
    while ($reader.Read()) {
        $din = $reader["DIN"].ToString()
        $clock = [DateTime]$reader["Clock"]
        $key = "$din-$($clock.ToString('yyyyMMddHHmmss'))"
        $existingClocks[$key] = $true
    }
    $reader.Close()
    Write-Host "Loaded $($existingClocks.Count) existing record keys."

    $insertCount = 0
    $dupCount = 0
    $nextId = $currentMaxId + 1
    $collectDateOleDb = (Get-Date).ToString("MM/dd/yyyy HH:mm:ss")

    Write-Host "Scanning records for missing entries..."
    for ($i = 0; $i -lt $parsedCount; $i++) {
        $rec = $sortedRecords[$i]
        $din   = $rec.DIN
        $action = $rec.Action
        $verifyMode = $rec.VerifyMode
        $clock = $rec.Clock

        # Skip system admin / device menu punches (DIN 0)
        if ($din -eq 0 -or $din -eq "0") {
            continue
        }

        # Check in memory for duplicates
        $key = "$din-$($clock.ToString('yyyyMMddHHmmss'))"
        if ($existingClocks.ContainsKey($key)) {
            $dupCount++
            continue
        }

        # Insert record into Access DB
        $clockOleDb = $clock.ToString("MM/dd/yyyy HH:mm:ss")
        $insertCmd = $conn.CreateCommand()
        $insertCmd.Transaction = $transaction
        $insertCmd.CommandText = "INSERT INTO ras_AttRecord (ID, DIN, Clock, VerifyMode, [Action], AttTypeId, DN, CollectDate) VALUES ($nextId, $din, #$clockOleDb#, $verifyMode, $action, 'H01', 2, #$collectDateOleDb#)"

        try {
            $insertCmd.ExecuteNonQuery() | Out-Null
            $insertCount++
            $nextId++
        } catch {
            Write-Host "Insert failed DIN=$din Clock=$($clock.ToString('yyyy-MM-dd HH:mm:ss')): $_"
        }
    }

    # Commit transaction
    Write-Host "Committing transaction..."
    $transaction.Commit()
    $conn.Close()
    Write-Host "Transaction committed. Database connection closed."
    Write-Host "Summary: Parsed=$parsedCount Inserted=$insertCount Duplicates=$dupCount"

} catch {
    Write-Host "FATAL ERROR: $_"
    if ($conn -and $conn.State -eq [System.Data.ConnectionState]::Open) { $conn.Close() }
    try { $device.CloseDevice() | Out-Null } catch {}
}
Write-Host "Recovery script complete."
Write-Host "=========================================="
