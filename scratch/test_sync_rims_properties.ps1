$ErrorActionPreference = "Stop"

$tempFile = "C:\RAMS\temp_templates.json"
$logFile = "C:\RAMS\sync_rims_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING SYNC RIMS PROPERTIES TEST ===")

# --- PROCESS 1: READ FROM OFFICE 1 ---
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

    $device.OpenDevice() | Out-Null

    $queryList = New-Object 'System.Collections.Generic.List[RealandAPI.Enroll]'
    for ($f = 0; $f -le 9; $f++) {
        $e = New-Object RealandAPI.Enroll
        $e.DN = 2
        $e.DIN = [uint64]27
        $e.BackupNumber = $f
        $queryList.Add($e)
    }

    $device.GetEnrollO([ref]$queryList) | Out-Null
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
                    Privilege    = $e.Privilege
                    ValidDate    = $e.ValidDate.ToString("yyyy-MM-dd HH:mm:ss")
                    InvalidDate  = $e.InvalidDate.ToString("yyyy-MM-dd HH:mm:ss")
                }
            }
        }
    }

    if ($templates.Count -gt 0) {
        $templates | ConvertTo-Json | Set-Content -Path "C:\RAMS\temp_templates.json"
        Write-Output "Successfully read $($templates.Count) templates."
    } else {
        Write-Error "No templates read!"
    }
}

try {
    $readOutput = powershell -NoProfile -ExecutionPolicy Bypass -Command $readCmd
    [void]$sb.AppendLine("Read Output: $readOutput")
} catch {
    [void]$sb.AppendLine("Read Failed: $_")
    [System.IO.File]::WriteAllText($logFile, $sb.ToString())
    exit 1
}

# --- PROCESS 2: WRITE TO OFFICE 2 WITH RIMS PROPERTIES ---
$writeCmd = {
    $ErrorActionPreference = "Stop"
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

    $templates = Get-Content -Path "C:\RAMS\temp_templates.json" -Raw | ConvertFrom-Json
    
    # Connect to Office 2 ZDFinger
    $device = New-Object RealandAPI.ZDFinger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.74"
    $device.IpPort = 5550
    $device.DN = 1
    $device.Password = 0

    $device.OpenDevice() | Out-Null

    foreach ($t in $templates) {
        $enroll = New-Object RealandAPI.Enroll
        $enroll.DN = 1
        $enroll.DIN = [uint64]27
        $enroll.BackupNumber = $t.BackupNumber
        $enroll.Privilege = $t.Privilege
        $enroll.Fingerprint = $t.Fingerprint
        $enroll.Enable = $true
        $enroll.UserName = "SALVIN RAMESH"

        # Populate RIMS properties
        $enroll.ValidDate = [DateTime]$t.ValidDate
        $enroll.InvalidDate = [DateTime]$t.InvalidDate
        $enroll.Password = [uint32]0
        $enroll.TimeAccessZone = 0
        $enroll.UnlockGroup = 0
        $enroll.UserExtInfo = ""

        Write-Output "Uploading finger $($t.BackupNumber) with SetEnroll..."
        $res1 = $device.SetEnroll($enroll)
        Write-Output "  SetEnroll result: $res1"

        Write-Output "Uploading finger $($t.BackupNumber) with SetEnrollO..."
        $res2 = $device.SetEnrollO($enroll)
        Write-Output "  SetEnrollO result: $res2"

        # Try SetUserName as well
        $nameRes = $device.SetUserName($enroll)
        Write-Output "  SetUserName result: $nameRes"
    }

    $device.CloseDevice()
    Remove-Item -Path "C:\RAMS\temp_templates.json" -Force
}

try {
    $writeOutput = powershell -NoProfile -ExecutionPolicy Bypass -Command $writeCmd
    [void]$sb.AppendLine("Write Output:")
    foreach ($line in $writeOutput) {
        [void]$sb.AppendLine("  $line")
    }
} catch {
    [void]$sb.AppendLine("Write Failed: $_")
    if (Test-Path $tempFile) {
        Remove-Item -Path $tempFile -Force
    }
}

[void]$sb.AppendLine("=== TEST COMPLETE ===")
[System.IO.File]::WriteAllText($logFile, $sb.ToString())
Write-Output "Results written to $logFile"
