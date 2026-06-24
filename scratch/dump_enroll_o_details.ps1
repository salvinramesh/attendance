$ErrorActionPreference = "Stop"

$dllPath = "C:\RAMS\RealandAPI.dll"
$rissDllPath = "C:\RAMS\Riss.Devices.dll"

[System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

$outputFile = "C:\RAMS\dump_enroll_o_results.txt"
$sb = New-Object System.Text.StringBuilder

$device = New-Object RealandAPI.ZDC2911Finger
$device.Communication = 1
$device.IpAddress = "192.168.5.61"
$device.IpPort = 5500
$device.DN = 2
$device.Password = 0

$device.OpenDevice() | Out-Null

$queryList = New-Object 'System.Collections.Generic.List[RealandAPI.Enroll]'
$e = New-Object RealandAPI.Enroll
$e.DN = 2
$e.DIN = [uint64]27
$e.BackupNumber = 0 # First finger
$queryList.Add($e)

$device.GetEnrollO([ref]$queryList) | Out-Null
$device.CloseDevice()

$item = $queryList[0]
[void]$sb.AppendLine("=== GetEnrollO properties ===")
$item | Get-Member -MemberType Property | ForEach-Object {
    $propName = $_.Name
    $propVal = $item.$propName
    [void]$sb.AppendLine("  Property $propName = $propVal (Definition: $($_.Definition))")
}

[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
