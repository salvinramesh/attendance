# PowerShell script to poll and synchronize biometrics from Office 1 RAMS DB to Office 2 ZDFinger device.
# Location: C:\RAMS\sync-biometrics.ps1

$ErrorActionPreference = "Stop"

# --- CONFIGURATION ---
$apiUrl = "https://timetracker.actionfi.com/api/sync/biometrics"
$apiKey = "07ee1ea2ba4c66893948c2a68fb3086f5411e10fe528a2bd"
$logFile = "C:\RAMS\sync-biometrics-log.txt"
# ---------------------

function Write-Log($message, $level = "INFO") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$level] $message"
    Write-Host $logLine
    Add-Content -Path $logFile -Value $logLine -ErrorAction SilentlyContinue
}

Write-Log "=========================================="
Write-Log "Starting biometric sync polling..."

try {
    # 1. Poll the API for pending sync jobs
    $headers = @{
        "Content-Type" = "application/json"
        "x-api-key"    = $apiKey
    }

    $response = Invoke-RestMethod -Uri $apiUrl -Method Get -Headers $headers -TimeoutSec 30
    
    if (-not $response.success) {
        Write-Log "Polling failed: $($response.error)" "ERROR"
        exit 1
    }

    $jobs = $response.jobs
    Write-Log "Found $($jobs.Count) pending sync jobs."

    foreach ($job in $jobs) {
        $jobId = $job.enrollmentId
        $userId = $job.userId
        $userName = $job.userName
        $office1EnrollId = $job.office1EnrollId
        $office2EnrollId = $job.office2EnrollId
        $fingerprints = $job.fingerprints

        Write-Log "Processing sync job $jobId for employee $userName (User ID: $userId, Office 1 DIN: $office1EnrollId, Office 2 DIN: $office2EnrollId)..."

        # 2. If fingerprints are not cached on server, fetch them from RAMS Access DB
        if ($fingerprints -eq $null -or $fingerprints.Count -eq 0) {
            Write-Log "No templates cached on server. Querying local RAMS database for Office 1 DIN: $office1EnrollId..."
            
            $dbPath = "C:\RAMS\Database\RAS.mdb"
            if (-not (Test-Path $dbPath)) {
                $errorMsg = "Local RAMS database file not found at $dbPath"
                Write-Log $errorMsg "ERROR"
                
                # Report failure to server
                $payload = @{
                    action = "update-status"
                    enrollmentId = $jobId
                    status = "FAILED"
                    error = $errorMsg
                } | ConvertTo-Json
                Invoke-RestMethod -Uri $apiUrl -Method Post -Body $payload -Headers $headers -TimeoutSec 30 | Out-Null
                continue
            }

            $conn = $null
            $localTemplates = @()
            try {
                $connStr = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$dbPath;Jet OLEDB:Database Password=ras258;"
                $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
                $conn.Open()

                $dbCmd = $conn.CreateCommand()
                $dbCmd.CommandText = "SELECT BackupNumber, Fingerprint FROM ras_Enroll WHERE DIN = $office1EnrollId AND BackupNumber <= 9"
                $reader = $dbCmd.ExecuteReader()
                while ($reader.Read()) {
                    $bn = [int]$reader["BackupNumber"]
                    $fp = $reader["Fingerprint"]
                    if ($fp -ne [System.DBNull]::Value -and $fp.ToString().Trim().Length -gt 10) {
                        $localTemplates += @{
                            fingerId = $bn
                            template = $fp.ToString()
                        }
                    }
                }
                $reader.Close()
                $conn.Close()
            } catch {
                Write-Log "Failed to query RAMS database: $_" "ERROR"
                if ($conn -and $conn.State -eq [System.Data.ConnectionState]::Open) {
                    $conn.Close()
                }
            }

            if ($localTemplates.Count -eq 0) {
                $errorMsg = "No fingerprint templates found for employee $userName (Office 1 DIN: $office1EnrollId) in RAMS database."
                Write-Log $errorMsg "ERROR"

                # Report failure to server
                $payload = @{
                    action = "update-status"
                    enrollmentId = $jobId
                    status = "FAILED"
                    error = $errorMsg
                } | ConvertTo-Json
                Invoke-RestMethod -Uri $apiUrl -Method Post -Body $payload -Headers $headers -TimeoutSec 30 | Out-Null
                continue
            }

            Write-Log "Found $($localTemplates.Count) fingerprint templates in RAMS. Uploading to cache on server..."
            
            # Upload templates to server
            $payload = @{
                action = "upload-templates"
                userId = $userId
                templates = $localTemplates
            } | ConvertTo-Json -Depth 5
            
            $uploadRes = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $payload -Headers $headers -TimeoutSec 30
            if ($uploadRes.success) {
                Write-Log "Successfully uploaded templates to cache."
                $fingerprints = $localTemplates
            } else {
                Write-Log "Failed to upload templates: $($uploadRes.error)" "ERROR"
                continue
            }
        }

        # 3. Connect to Office 2 scanner and write templates
        Write-Log "Writing $($fingerprints.Count) templates to Office 2 scanner (DIN: $office2EnrollId) in isolated sub-process..."
        
        # Serialize the fingerprints list to JSON to pass to sub-process
        $fpJson = $fingerprints | ConvertTo-Json -Compress -Depth 5
        
        # Set environment variables for the sub-process
        $env:SYNC_TARGET_DIN = $office2EnrollId
        $env:SYNC_EMPLOYEE_NAME = $userName
        $env:SYNC_FP_JSON = $fpJson

        $subProcessCmd = {
            $ErrorActionPreference = 'Stop'
            Set-Location 'D:\RIMS'
            [System.Reflection.Assembly]::LoadFrom('D:\RIMS\Riss.Devices.dll') | Out-Null
            [System.Reflection.Assembly]::LoadFrom('D:\RIMS\RealandAPI.dll') | Out-Null

            # Retrieve parameters from environment variables
            $targetDin = $env:SYNC_TARGET_DIN
            $employeeName = $env:SYNC_EMPLOYEE_NAME
            $fpsJsonStr = $env:SYNC_FP_JSON

            $device = New-Object RealandAPI.ZDFinger
            $device.Communication = 1
            $device.IpAddress = '192.168.5.74'
            $device.IpPort = 5550
            $device.DN = 1
            $device.Password = 0

            $opened = $false
            for ($attempt = 1; $attempt -le 10; $attempt++) {
                $opened = $device.OpenDevice()
                if ($opened) { break }
                Start-Sleep -Seconds 3
            }
            if (-not $opened) {
                throw 'Open Device Failed!'
            }

            $templatesObj = $fpsJsonStr | ConvertFrom-Json
            
            # Helper to parse space-separated hex words to Byte[]
            $parseHex = {
                param($hexStr)
                $chunks = $hexStr -split ' '
                $bytesList = New-Object System.Collections.Generic.List[Byte]
                foreach ($chunk in $chunks) {
                    $val = [System.Convert]::ToUInt32($chunk, 16)
                    $chunkBytes = [System.BitConverter]::GetBytes($val)
                    $bytesList.AddRange($chunkBytes)
                }
                return $bytesList.ToArray()
            }

            try {
                foreach ($t in $templatesObj) {
                    $fingerId = $t.fingerId
                    $shortBytes = &$parseHex $t.template

                    # 1. Pad to 800 bytes
                    $paddedBytes = New-Object Byte[] 800
                    [System.Array]::Copy($shortBytes, $paddedBytes, $shortBytes.Length)

                    # 2. Convert to 1000-byte long message
                    $longBytes = $device.ConvertToLongMessage($paddedBytes)
                    if ($longBytes -eq $null -or $longBytes.Length -ne 1000) {
                        throw 'Failed to convert short template to 1000-byte long template'
                    }

                    # 3. Construct 1416-byte template array
                    $templateBytes = New-Object Byte[] 1416
                    
                    # 3a. "SmackBio" Magic Header
                    $headerMagic = [byte[]]@(0x53, 0x6d, 0x61, 0x63, 0x6b, 0x42, 0x69, 0x6f)
                    [System.Array]::Copy($headerMagic, $templateBytes, 8)

                    # 3b. DIN (little endian)
                    $dinBytes = [System.BitConverter]::GetBytes([uint32]$targetDin)
                    [System.Array]::Copy($dinBytes, 0, $templateBytes, 8, 4)

                    # 3c. Word 3 low byte set to 0x01, high byte/checksum to 0x00 initially
                    $word3Bytes = [byte[]]@(0x01, 0x00, 0x00, 0x00)
                    [System.Array]::Copy($word3Bytes, 0, $templateBytes, 12, 4)

                    # 3d. Raw template data (1000 bytes)
                    [System.Array]::Copy($longBytes, 0, $templateBytes, 16, 1000)

                    # 3e. Pad remaining with zeros (already zero-initialized)

                    # 3f. Calculate checksum over bytes 12 to 1295 and write to byte 15
                    $chkSum = 0
                    for ($i = 12; $i -lt 1296; $i++) {
                        $chkSum += $templateBytes[$i]
                    }
                    $templateBytes[15] = $chkSum % 256

                    # 4. Format 1416 bytes back to space-separated hex words string
                    $words = @()
                    for ($i = 0; $i -lt $templateBytes.Length; $i += 4) {
                        $wVal = [System.BitConverter]::ToUInt32($templateBytes, $i)
                        $words += '{0:X8}' -f $wVal
                    }
                    $longFpStr = $words -join ' '

                    # 5. Populate Enroll object and call SetEnroll
                    $enroll = New-Object RealandAPI.Enroll
                    $enroll.DN = 1
                    $enroll.DIN = [uint64]$targetDin
                    $enroll.BackupNumber = $fingerId
                    $enroll.Privilege = 0
                    $enroll.Fingerprint = $longFpStr
                    $enroll.Enable = $true
                    $enroll.UserName = $employeeName
                    $enroll.ValidDate = [DateTime]'2026-01-01 00:00:00'
                    $enroll.InvalidDate = [DateTime]'2099-12-31 23:59:59'
                    $enroll.Password = [uint32]0

                    $setRes = $device.SetEnroll($enroll)
                    if (-not $setRes) {
                        throw 'SetEnroll failed'
                    }

                    # Update user name
                    $nameRes = $device.SetUserName($enroll)
                }
                
                Write-Output 'SUCCESS'
            } catch {
                Write-Output "FAILED: $_"
            } finally {
                $device.CloseDevice()
            }
        }

        # Execute sub-process
        $cmdText = $subProcessCmd.ToString()
        $subProcessRes = powershell -NoProfile -ExecutionPolicy Bypass -Command $cmdText
        
        Write-Log "Sub-process output: $subProcessRes"

        # Clear environment variables
        Remove-Item Env:\SYNC_TARGET_DIN -ErrorAction SilentlyContinue
        Remove-Item Env:\SYNC_EMPLOYEE_NAME -ErrorAction SilentlyContinue
        Remove-Item Env:\SYNC_FP_JSON -ErrorAction SilentlyContinue

        if ($subProcessRes -like "*SUCCESS*") {
            Write-Log "Successfully synchronized $userName to Office 2 scanner."
            
            # Report SUCCESS to server
            $payload = @{
                action = "update-status"
                enrollmentId = $jobId
                status = "SYNCED"
            } | ConvertTo-Json
            Invoke-RestMethod -Uri $apiUrl -Method Post -Body $payload -Headers $headers -TimeoutSec 30 | Out-Null
        } else {
            $errorStr = if ($subProcessRes -is [array]) { $subProcessRes -join "`n" } else { $subProcessRes.ToString() }
            Write-Log "Sub-process failed: $errorStr" "ERROR"
            
            # Report FAILURE to server
            $payload = @{
                action = "update-status"
                enrollmentId = $jobId
                status = "FAILED"
                error = $errorStr
            } | ConvertTo-Json
            Invoke-RestMethod -Uri $apiUrl -Method Post -Body $payload -Headers $headers -TimeoutSec 30 | Out-Null
        }
    }

} catch {
    Write-Log "Error during biometric sync process: $_" "ERROR"
}

Write-Log "Biometric sync polling complete."
Write-Log "=========================================="
