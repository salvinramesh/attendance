$dllPath = "D:\RIMS\RealandAPI.dll"
$rissDllPath = "D:\RIMS\Riss.Devices.dll"

# Load in correct order
[System.Reflection.Assembly]::LoadFile($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFile($dllPath) | Out-Null

$outputFile = "C:\RAMS\read_office2_results.txt"
$sb = New-Object System.Text.StringBuilder

$device = New-Object RealandAPI.ZDFinger
$device.Communication = 1  # TCP/IP
$device.IpAddress = "192.168.5.74"
$device.IpPort = 5550
$device.DN = 1
$device.Password = 0

[void]$sb.AppendLine("Connecting to Office 2 scanner via ZDFinger...")
$opened = $device.OpenDevice()
if (-not $opened) {
    [void]$sb.AppendLine("Failed to connect to Office 2 scanner via ZDFinger!")
    [System.IO.File]::WriteAllText($outputFile, $sb.ToString())
    exit 1
}
[void]$sb.AppendLine("Connected to Office 2 scanner successfully!")

# Fetch all enrolls
[void]$sb.AppendLine("Getting attendance records to verify connection...")
$records = $device.GetAttRecords($false, $true)
[void]$sb.AppendLine("Total records fetched: $($records.Count)")

$device.CloseDevice()
[void]$sb.AppendLine("Device connection closed.")

[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
