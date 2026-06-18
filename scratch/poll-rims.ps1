# poll-rims.ps1 — Headless Realand scanner poller for Office 2
# Uses RealandAPI.dll GetRecords (string-based) to pull attendance records
# and inserts them into D:\RIMS\Database\RAS.mdb
# Location: D:\RIMS\poll-rims.ps1
# Record CSV format: DIN, Action, VerifyMode, Year, Month, Day, Hour, Minute, Second (9 fields per record)

$ErrorActionPreference = "Stop"

# --- CONFIGURATION ---
$dllPath       = "D:\RIMS\RealandAPI.dll"
$rissDllPath   = "D:\RIMS\Riss.Devices.dll"
$dbPath        = "D:\RIMS\Database\RAS.mdb"
$dbPassword    = "ras258"
$scannerIp     = "192.168.5.74"
$scannerPort   = 5550
$scannerDN     = 1
$scannerPass   = 0
$logFile       = "D:\RIMS\poll-rims-log.txt"
$fieldsPerRec  = 9
# ---------------------

function Write-Log($message, $level = "INFO") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$level] $message"
    Write-Host $logLine
    Add-Content -Path $logFile -Value $logLine -ErrorAction SilentlyContinue
}

Write-Log "=========================================="
Write-Log "Starting RIMS headless scanner poll..."

try {
    # 1. Load dependencies
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFile($rissDllPath) | Out-Null
    [System.Reflection.Assembly]::LoadFile($dllPath) | Out-Null
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
    $device = New-Object RealandAPI.ZDFinger
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

    # 4. Get status (disabled as it causes GetRecords to fail)
    # try {
    #     $status = $device.GetStatus()
    #     Write-Log ("Device status - Users: " + $status.Users + " FP: " + $status.Fingerprints + " NewAtt: " + $status.NewlyAttendance + " AllAtt: " + $status.AllAttendance)
    # } catch {
    #     Write-Log "Could not get status: $_" "WARN"
    # }

    # 5. Download ALL records using string-based method
    Write-Log "Downloading records from scanner (string method)..."
    [string]$strData = ''
    $totalRecords = $device.GetRecords([ref]$strData, $false, $true)  # all records, device already opened
    Write-Log "GetRecords returned count=$totalRecords strLen=$($strData.Length)"

    # Close device connection immediately
    $device.CloseDevice()
    Write-Log "Device connection closed."

    if ($totalRecords -le 0 -or $strData.Length -eq 0) {
        Write-Log "No records retrieved from scanner."
        $conn.Close()
        Write-Log "=========================================="
        exit 0
    }

    # 6. Parse CSV data - format: DIN, Action, VerifyMode, Year, Month, Day, Hour, Minute, Second
    $vals = $strData.TrimEnd(',').Split(',')
    $parsedCount = [Math]::Floor($vals.Count / $fieldsPerRec)
    Write-Log "Parsed $parsedCount records from CSV data."

    # 7. Filter and insert only NEW records (after lastClock)
    $insertCount = 0
    $skipCount = 0
    $dupCount = 0
    $nextId = $currentMaxId + 1

    for ($i = 0; $i -lt $parsedCount; $i++) {
        $offset = $i * $fieldsPerRec
        $din   = [int]$vals[$offset]
        $action = [int]$vals[$offset + 1]
        $verifyMode = [int]$vals[$offset + 2]
        $year  = [int]$vals[$offset + 3]
        $month = [int]$vals[$offset + 4]
        $day   = [int]$vals[$offset + 5]
        $hour  = [int]$vals[$offset + 6]
        $min   = [int]$vals[$offset + 7]
        $sec   = [int]$vals[$offset + 8]

        try {
            $clock = New-Object DateTime($year, $month, $day, $hour, $min, $sec)
        } catch {
            $skipCount++
            continue
        }

        # Skip records that are older than or equal to lastClock
        if ($clock -le $lastClock) {
            $skipCount++
            continue
        }

        # Map Action to AttTypeId
        $attTypeId = "H01"
        if ($action -eq 0) { $attTypeId = "H05" }       # Check In / Clock In
        elseif ($action -eq 1) { $attTypeId = "H06" }   # Check Out / Clock Out
        elseif ($action -eq 4) { $attTypeId = "H11" }   # Normal Open
        elseif ($action -eq 5) { $attTypeId = "H12" }   # Button Open

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

        # Insert record
        $insertCmd = $conn.CreateCommand()
        $insertCmd.CommandText = "INSERT INTO ras_AttRecord (ID, DIN, Clock, VerifyMode, AttTypeId) VALUES ($nextId, $din, #$clockOleDb#, $verifyMode, '$attTypeId')"

        try {
            $insertCmd.ExecuteNonQuery() | Out-Null
            $insertCount++
            if ($insertCount -le 20) {
                Write-Log "  + ID=$nextId DIN=$din Clock=$($clock.ToString('yyyy-MM-dd HH:mm:ss')) VM=$verifyMode AttType=$attTypeId"
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
    try { $device.CloseDevice() } catch {}
}

Write-Log "RIMS headless poll complete."
Write-Log "=========================================="
