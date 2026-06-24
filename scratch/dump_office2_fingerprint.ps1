$ErrorActionPreference = "Stop"

$dllPath = "D:\RIMS\RealandAPI.dll"
$rissDllPath = "D:\RIMS\Riss.Devices.dll"

[System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

$outputFile = "C:\RAMS\office2_fp_dump.txt"
$sb = New-Object System.Text.StringBuilder

$device = New-Object RealandAPI.ZDFinger
$device.Communication = 1
$device.IpAddress = "192.168.5.74"
$device.IpPort = 5550
$device.DN = 1
$device.Password = 0

$device.OpenDevice() | Out-Null

$e = New-Object RealandAPI.Enroll
$e.DN = 1
$e.DIN = [uint64]12
$e.BackupNumber = 0

$res = $device.GetEnroll($e)
$device.CloseDevice()

[void]$sb.AppendLine("GetEnroll result: $res")
if ($res -and $e.Fingerprint -ne $null) {
    $fpStr = $e.Fingerprint.ToString()
    [void]$sb.AppendLine("Fingerprint type: $($e.Fingerprint.GetType().FullName)")
    [void]$sb.AppendLine("Fingerprint length: $($fpStr.Length)")
    [void]$sb.AppendLine("First 150 chars: $($fpStr.Substring(0, [System.Math]::Min(150, $fpStr.Length)))")
} else {
    [void]$sb.AppendLine("Fingerprint is null or query failed!")
}

[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
