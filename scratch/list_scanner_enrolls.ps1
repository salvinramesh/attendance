$ErrorActionPreference = "Stop"

Set-Location "D:\RIMS"
[System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
[System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

$device = New-Object RealandAPI.ZDFinger
$device.Communication = 1
$device.IpAddress = "192.168.5.74"
$device.IpPort = 5550
$device.DN = 1
$device.Password = 0

if (-not $device.OpenDevice()) {
    throw "Failed to connect to scanner!"
}

$enrolls = $device.GetAllEnroll()
$device.CloseDevice()

$outputFile = "C:\RAMS\list_scanner_enrolls.txt"
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("=== SCANNER ENROLLMENTS ===")
[void]$sb.AppendLine("Total: $($enrolls.Count)")

foreach ($e in $enrolls) {
    $hasFp = $false
    if ($e.Fingerprint -ne $null -and $e.Fingerprint.ToString().Trim().Length -gt 10) {
        $hasFp = $true
    }
    [void]$sb.AppendLine("DIN: $($e.DIN) | BackupNumber: $($e.BackupNumber) | Name: $($e.UserName) | HasFP: $hasFp")
}

[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Done. Written to $outputFile"
