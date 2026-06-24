$ErrorActionPreference = "Stop"

$dllPath = "D:\RIMS\RealandAPI.dll"
$rissDllPath = "D:\RIMS\Riss.Devices.dll"

[System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

# Read active DINs from JSON
$jsonPath = "C:\RAMS\active_device2_dins.json"
if (-not (Test-Path $jsonPath)) {
    throw "Active DINs JSON file not found at $jsonPath"
}
$activeDins = Get-Content -Path $jsonPath -Raw | ConvertFrom-Json
$activeDinsSet = New-Object System.Collections.Generic.HashSet[int]
foreach ($id in $activeDins) {
    [void]$activeDinsSet.Add($id)
}

# Connect to scanner
$device = New-Object RealandAPI.ZDFinger
$device.Communication = 1
$device.IpAddress = "192.168.5.74"
$device.IpPort = 5550
$device.DN = 1
$device.Password = 0

if (-not $device.OpenDevice()) {
    throw "Failed to connect to scanner!"
}

# Fetch all enrolls
$enrolls = $device.GetAllEnroll()
$device.CloseDevice()

Write-Output "Scanner has $($enrolls.Count) enrollments."

$staleEnrolls = @()
$seenDins = New-Object System.Collections.Generic.HashSet[int]

foreach ($e in $enrolls) {
    $din = [int]$e.DIN
    if ($din -eq 0) { continue } # Skip admin/system user
    
    # If DIN is NOT in active database set
    if (-not $activeDinsSet.Contains($din)) {
        if (-not $seenDins.Contains($din)) {
            [void]$seenDins.Add($din)
            $staleEnrolls += @{
                DIN = $din
                Name = $e.UserName
            }
        }
    }
}

Write-Output "Found $($staleEnrolls.Count) stale unique DINs on the scanner:"
foreach ($se in $staleEnrolls) {
    Write-Output "  DIN: $($se.DIN) | Name: $($se.Name)"
}
