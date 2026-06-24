$ErrorActionPreference = "Continue"
Set-Location "D:\RIMS"
[System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
[System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

# List all methods on ZDFinger
$device = New-Object RealandAPI.ZDFinger
$methods = $device.GetType().GetMethods() | Select-Object Name -Unique | Sort-Object Name
foreach ($m in $methods) {
    Write-Output $m.Name
}
