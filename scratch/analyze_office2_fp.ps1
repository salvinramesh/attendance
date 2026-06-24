$ErrorActionPreference = "Stop"

$dllPath = "D:\RIMS\RealandAPI.dll"
$rissDllPath = "D:\RIMS\Riss.Devices.dll"

[System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

$outputFile = "C:\RAMS\office2_full_fp.txt"

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

if ($res -and $e.Fingerprint -ne $null) {
    $fpStr = $e.Fingerprint.ToString()
    Set-Content -Path $outputFile -Value $fpStr
    Write-Output "Template dumped successfully. Length: $($fpStr.Length)"
} else {
    Write-Error "Fingerprint is null or query failed!"
}
