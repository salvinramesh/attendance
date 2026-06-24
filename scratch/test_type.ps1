$dllPath = "C:\RAMS\RealandAPI.dll"
$rissDllPath = "C:\RAMS\Riss.Devices.dll"

[System.Reflection.Assembly]::LoadFile($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFile($dllPath) | Out-Null

$device = New-Object RealandAPI.ZDC2911Finger
$device.Communication = 1
$device.IpAddress = "192.168.5.61"
$device.IpPort = 5500
$device.DN = 2
$device.Password = 0

$device.OpenDevice() | Out-Null
$list = New-Object 'System.Collections.Generic.List[RealandAPI.Enroll]'
$e = New-Object RealandAPI.Enroll
$e.DN = 2
$e.DIN = [uint64]27
$e.BackupNumber = 0
$list.Add($e)
$device.GetEnrollO([ref]$list) | Out-Null
$device.CloseDevice()

Write-Output "Type is: $($list[0].Fingerprint.GetType().FullName)"
