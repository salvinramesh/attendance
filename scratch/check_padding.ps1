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

$e = New-Object RealandAPI.Enroll
$e.DN = 1
$e.DIN = [uint64]12
$e.BackupNumber = 0
$res = $device.GetEnroll($e)

$device.CloseDevice()

if (-not $res -or $e.Fingerprint -eq $null) {
    Write-Output "Failed to get enrollment for DIN 12"
    exit 1
}

$chunks = $e.Fingerprint.ToString() -split ' '
$bytes = New-Object System.Collections.Generic.List[Byte]
foreach ($chunk in $chunks) {
    $val = [System.Convert]::ToUInt32($chunk, 16)
    $bytes.AddRange([System.BitConverter]::GetBytes($val))
}

$nonZeroAfter1016 = 0
$totalBytes = $bytes.Count
for ($i = 1016; $i -lt $bytes.Count; $i++) {
    if ($bytes[$i] -ne 0) {
        $nonZeroAfter1016++
    }
}

Write-Output "Total bytes in template: $totalBytes"
Write-Output "Non-zero bytes after index 1015: $nonZeroAfter1016"
if ($nonZeroAfter1016 -gt 0) {
    Write-Output "First 20 non-zero bytes after 1015:"
    $count = 0
    for ($i = 1016; $i -lt $bytes.Count; $i++) {
        if ($bytes[$i] -ne 0) {
            $hexVal = "{0:X2}" -f $bytes[$i]
            Write-Output ("  Index {0}: 0x{1}" -f $i, $hexVal)
            $count++
            if ($count -ge 20) { break }
        }
    }
}
