# poll-rams.ps1 — Headless Realand scanner poller for Office 1
# Uses RealandAPI.dll (ZDC2911Finger class) to pull attendance records
# and inserts them into C:\RAMS\Database\RAS.mdb
# Location: C:\RAMS\poll-rams.ps1

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
$logFile       = "C:\RAMS\poll-rams-log.txt"
# ---------------------

function Write-Log($message, $level = "INFO") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$level] $message"
    Write-Host $logLine
    Add-Content -Path $logFile -Value $logLine -ErrorAction SilentlyContinue
}

Write-Log "=========================================="
Write-Log "Starting RAMS headless scanner poll..."

$conn = $null
$device = $null

try {
    # 1. Load dependencies
    Set-Location "C:\RAMS"
    [System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
    [System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null
    Write-Log "DLLs loaded."

    # 2. Connect to Access database to get last known record time
    $connStr = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$dbPath;Jet OLEDB:Database Password=$dbPassword;"
    $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
    $conn.Open()
    Write-Log "Connected to Access database."

    # Get current max ID and last clock
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT MAX(ID) FROM ras_AttRecord"
    $maxIdResult = $cmd.ExecuteScalar()
    $currentMaxId = if ($maxIdResult -eq [System.DBNull]::Value -or $maxIdResult -eq $null) { 0 } else { [int]$maxIdResult }

    $cmd.CommandText = "SELECT TOP 1 Clock FROM ras_AttRecord ORDER BY ID DESC"
    $lastClockResult = $cmd.ExecuteScalar()
    $lastClock = if ($lastClockResult -eq [System.DBNull]::Value -or $lastClockResult -eq $null) { [DateTime]::MinValue } else { [DateTime]$lastClockResult }
    Write-Log "Current max ID: $currentMaxId  Last clock: $($lastClock.ToString('yyyy-MM-dd HH:mm:ss'))"

    # 3. Create device and connect to scanner
    $device = New-Object RealandAPI.ZDC2911Finger
    $device.Communication = 1  # TCP/IP
    $device.IpAddress = $scannerIp
    $device.IpPort = $scannerPort
    $device.DN = $scannerDN
    $device.Password = $scannerPass
    Write-Log "Device configured: ${scannerIp}:${scannerPort} DN=$scannerDN"

    $opened = $device.OpenDevice()
    if (-not $opened) {
        Write-Log "Failed to open device connection!" "ERROR"
        $conn.Close()
        exit 1
    }
    Write-Log "Device connection opened."

    # 4. Set date range for log fetching
    # Start date is the day of last clock minus 1 day (to capture any late/pending clocks on that day)
    # End date is tomorrow's date to cover all today's entries
    $startDate = if ($lastClock -gt [DateTime]"2000-01-01") { $lastClock.AddDays(-1).Date } else { (Get-Date).AddDays(-30).Date }
    $endDate = (Get-Date).AddDays(1).Date
    
    Write-Log "Syncing date range from $($startDate.ToString('yyyy-MM-dd')) to $($endDate.ToString('yyyy-MM-dd'))"
    
    $dates = New-Object 'System.Collections.Generic.List[datetime]'
    $dates.Add($startDate)
    $dates.Add($endDate)

    # 5. Download records using ZDC2911Finger specific methods
    Write-Log "Reading all general log data on device..."
    $readResult = $device.ReadAllGLogData($dates)
    Write-Log "ReadAllGLogData result: $readResult"

    Write-Log "Fetching records from device..."
    $records = $device.GetAllRecords($dates)
    
    # Close device connection immediately
    $device.CloseDevice() | Out-Null
    Write-Log "Device connection closed."

    if ($records -eq $null -or $records.Count -eq 0) {
        Write-Log "No records retrieved from scanner."
        $conn.Close()
        Write-Log "=========================================="
        exit 0
    }

    Write-Log "Retrieved $($records.Count) records. Sorting chronologically..."
    $sortedRecords = $records | Sort-Object Clock
    $parsedCount = $sortedRecords.Count

    # 6. Filter and insert only NEW records (after lastClock)
    $insertCount = 0
    $skipCount = 0
    $dupCount = 0
    $nextId = $currentMaxId + 1

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

        # Checking all records in the date range against the database to allow recovering misdated logs

        # Check for duplicate (same DIN and Clock)
        $clockOleDb = $clock.ToString("MM/dd/yyyy HH:mm:ss")
        $checkCmd = $conn.CreateCommand()
        $checkCmd.CommandText = "SELECT COUNT(*) FROM ras_AttRecord WHERE DIN = $din AND Clock = #$clockOleDb#"
        try {
            $exists = [int]$checkCmd.ExecuteScalar()
        } catch {
            $exists = 0
        }

        if ($exists -gt 0) {
            $dupCount++
            continue
        }

        # Insert record into Access DB
        # Columns: ID, DIN, Clock, VerifyMode, [Action], AttTypeId, DN, CollectDate
        $collectDateOleDb = (Get-Date).ToString("MM/dd/yyyy HH:mm:ss")
        $insertCmd = $conn.CreateCommand()
        $insertCmd.CommandText = "INSERT INTO ras_AttRecord (ID, DIN, Clock, VerifyMode, [Action], AttTypeId, DN, CollectDate) VALUES ($nextId, $din, #$clockOleDb#, $verifyMode, $action, 'H01', 2, #$collectDateOleDb#)"

        try {
            $insertCmd.ExecuteNonQuery() | Out-Null
            $insertCount++
            if ($insertCount -le 20) {
                Write-Log "  + ID=$nextId DIN=$din Clock=$($clock.ToString('yyyy-MM-dd HH:mm:ss')) VM=$verifyMode Action=$action"
            }
            $nextId++
        } catch {
            Write-Log "  ! Insert failed DIN=$din Clock=$($clock.ToString('yyyy-MM-dd HH:mm:ss')): $_" "WARN"
        }
    }

    $conn.Close()
    Write-Log "Database connection closed."
    Write-Log "Summary: Parsed=$parsedCount Inserted=$insertCount Skipped(old)=$skipCount Duplicates=$dupCount"

} catch {
    Write-Log "FATAL ERROR: $_" "ERROR"
    Write-Log $_.ScriptStackTrace "ERROR"
    try { if ($conn -and $conn.State -eq [System.Data.ConnectionState]::Open) { $conn.Close() } } catch {}
    try { if ($device) { $device.CloseDevice() | Out-Null } } catch {}
}

Write-Log "RAMS headless poll complete."
Write-Log "=========================================="
