$ErrorActionPreference = "Stop"

$dllPath = "D:\RIMS\RealandAPI.dll"
$rissDllPath = "D:\RIMS\Riss.Devices.dll"

[System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

$outputFile = "C:\RAMS\compare_fps.txt"
$sb = New-Object System.Text.StringBuilder

$device = New-Object RealandAPI.ZDFinger
$device.Communication = 1
$device.IpAddress = "192.168.5.74"
$device.IpPort = 5550
$device.DN = 1
$device.Password = 0

$device.OpenDevice() | Out-Null

# User 12
$e12 = New-Object RealandAPI.Enroll
$e12.DN = 1
$e12.DIN = [uint64]12
$e12.BackupNumber = 0
$res12 = $device.GetEnroll($e12)

# User 86
$e86 = New-Object RealandAPI.Enroll
$e86.DN = 1
$e86.DIN = [uint64]86
$e86.BackupNumber = 0
$res86 = $device.GetEnroll($e86)

$device.CloseDevice()

[void]$sb.AppendLine("=== COMPARISON RESULTS ===")
if ($res12 -and $e12.Fingerprint -ne $null) {
    [void]$sb.AppendLine("DIN 12 length: $($e12.Fingerprint.ToString().Length)")
    [void]$sb.AppendLine("DIN 12 snippet: $($e12.Fingerprint.ToString().Substring(0, 200))")
}
if ($res86 -and $e86.Fingerprint -ne $null) {
    [void]$sb.AppendLine("DIN 86 length: $($e86.Fingerprint.ToString().Length)")
    [void]$sb.AppendLine("DIN 86 snippet: $($e86.Fingerprint.ToString().Substring(0, 200))")
}

[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
