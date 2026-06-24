$ErrorActionPreference = "Stop"

$tempFile = "C:\RAMS\temp_templates.json"
$logFile = "C:\RAMS\sync_one_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING TWO-PROCESS SYNC TEST ===")

# --- PROCESS 1: READ FROM OFFICE 1 ---
[void]$sb.AppendLine("Launching Process 1 to read templates from Office 1 (3F)...")
$readCmd = {
    $ErrorActionPreference = "Stop"
    Set-Location "C:\RAMS"
    [System.Reflection.Assembly]::LoadFrom("C:\RAMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("C:\RAMS\RealandAPI.dll") | Out-Null

    $device = New-Object RealandAPI.ZDC2911Finger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.61"
    $device.IpPort = 5500
    $device.DN = 2
    $device.Password = 0

    $opened = $device.OpenDevice()
    if (-not $opened) {
        Write-Error "Failed to connect to Office 1 scanner!"
    }

    $queryList = New-Object 'System.Collections.Generic.List[RealandAPI.Enroll]'
    for ($f = 0; $f -le 9; $f++) {
        $e = New-Object RealandAPI.Enroll
        $e.DN = 2
        $e.DIN = [uint64]27
        $e.BackupNumber = $f
        $queryList.Add($e)
    }

    $res = $device.GetEnrollO([ref]$queryList)
    $device.CloseDevice()

    $templates = @()
    foreach ($e in $queryList) {
        if ($e.Fingerprint -ne $null) {
            $fpStr = $e.Fingerprint.ToString()
            if ($fpStr.Length -gt 10) {
                $templates += @{
                    BackupNumber = $e.BackupNumber
                    Fingerprint  = $fpStr
                    UserName     = $e.UserName
                }
            }
        }
    }

    $templates | ConvertTo-Json | Set-Content -Path "C:\RAMS\temp_templates.json"
    Write-Output "Successfully read $($templates.Count) templates from Office 1."
}

# Run Process 1
try {
    $readOutput = powershell -NoProfile -ExecutionPolicy Bypass -Command $readCmd
    [void]$sb.AppendLine("Process 1 Output: $readOutput")
} catch {
    [void]$sb.AppendLine("Process 1 Failed: $_")
    [System.IO.File]::WriteAllText($logFile, $sb.ToString())
    exit 1
}

# Verify temp file exists and is not empty
if (-not (Test-Path $tempFile) -or (Get-Item $tempFile).Length -eq 0) {
    [void]$sb.AppendLine("Process 1 did not write templates to JSON or file is empty!")
    [System.IO.File]::WriteAllText($logFile, $sb.ToString())
    exit 1
}

# --- PROCESS 2: WRITE TO OFFICE 2 ---
[void]$sb.AppendLine("Launching Process 2 to write templates to Office 2 (2F)...")
$writeCmd = {
    $ErrorActionPreference = "Stop"
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

    if (-not (Test-Path "C:\RAMS\temp_templates.json")) {
        Write-Error "JSON file not found!"
    }

    $templates = Get-Content -Path "C:\RAMS\temp_templates.json" -Raw | ConvertFrom-Json
    if ($templates -eq $null -or $templates.Count -eq 0) {
        Write-Error "No templates to write!"
    }

    # Connect to Office 2 ZDFinger
    $device = New-Object RealandAPI.ZDFinger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.74"
    $device.IpPort = 5550
    $device.DN = 1
    $device.Password = 0

    $opened = $device.OpenDevice()
    if (-not $opened) {
        Write-Error "Failed to connect to Office 2 scanner!"
    }

    # Upload templates
    foreach ($t in $templates) {
        $enroll = New-Object RealandAPI.Enroll
        $enroll.DN = 1
        $enroll.DIN = [uint64]27
        $enroll.BackupNumber = $t.BackupNumber
        $enroll.Privilege = 0 # Employee
        $enroll.Fingerprint = $t.Fingerprint
        $enroll.Enable = $true
        $enroll.UserName = "SALVIN RAMESH"
        
        Write-Output "Uploading finger $($t.BackupNumber) to Office 2..."
        $setRes = $device.SetEnroll($enroll)
        Write-Output "SetEnroll result: $setRes"
        
        $nameRes = $device.SetUserName($enroll)
        Write-Output "SetUserName result: $nameRes"
    }

    $device.CloseDevice()
    Remove-Item -Path "C:\RAMS\temp_templates.json" -Force
    Write-Output "Templates uploaded to Office 2 and temporary JSON cleaned up."
}

# Run Process 2
try {
    $writeOutput = powershell -NoProfile -ExecutionPolicy Bypass -Command $writeCmd
    [void]$sb.AppendLine("Process 2 Output: $writeOutput")
} catch {
    [void]$sb.AppendLine("Process 2 Failed: $_")
    if (Test-Path $tempFile) {
        Remove-Item -Path $tempFile -Force
    }
}

[void]$sb.AppendLine("=== TWO-PROCESS SYNC TEST COMPLETE ===")
[System.IO.File]::WriteAllText($logFile, $sb.ToString())
Write-Output "Results written to $logFile"
