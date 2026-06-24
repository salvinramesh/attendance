# check_rams_months.ps1 — Check record dates on Office 1 device

$ErrorActionPreference = "Stop"
$dllPath       = "C:\RAMS\RealandAPI.dll"
$rissDllPath   = "C:\RAMS\Riss.Devices.dll"
$outputFile    = "C:\RAMS\office1_months.txt"

try {
    Set-Location "C:\RAMS"
    [System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
    [System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

    $device = New-Object RealandAPI.ZDC2911Finger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.61"
    $device.IpPort = 5500
    $device.DN = 2
    $device.Password = 0

    if (-not $device.OpenDevice()) {
        "Failed to connect to RAMS device" | Set-Content -Path $outputFile
        exit 1
    }

    $dates = New-Object 'System.Collections.Generic.List[datetime]'
    $dates.Add([DateTime]"2025-01-01")
    $dates.Add([DateTime]"2026-07-01")

    $device.ReadAllGLogData($dates) | Out-Null
    $records = $device.GetAllRecords($dates)
    $device.CloseDevice() | Out-Null

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("Total records retrieved: $($records.Count)")
    
    $groups = $records | Group-Object { $_.Clock.ToString("yyyy-MM") } | Sort-Object Name
    foreach ($g in $groups) {
        [void]$sb.AppendLine("$($g.Name): $($g.Count)")
    }

    $sb.ToString() | Set-Content -Path $outputFile
} catch {
    "Error: $_" | Set-Content -Path $outputFile
}
