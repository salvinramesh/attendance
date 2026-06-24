$dllPath = "C:\RAMS\RealandAPI.dll"
[System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

$outputFile = "C:\RAMS\read_templates_results.txt"
$sb = New-Object System.Text.StringBuilder

$device = New-Object RealandAPI.ZDC2911Finger
$device.Communication = 1  # TCP/IP
$device.IpAddress = "192.168.5.61"
$device.IpPort = 5500
$device.DN = 2
$device.Password = 0

[void]$sb.AppendLine("Connecting to Office 1 scanner...")
$opened = $device.OpenDevice()
if (-not $opened) {
    [void]$sb.AppendLine("Failed to connect to Office 1 scanner!")
    [System.IO.File]::WriteAllText($outputFile, $sb.ToString())
    exit 1
}
[void]$sb.AppendLine("Connected to Office 1 scanner successfully!")

# Fetch all enrolls
$enrolls = $device.GetAllEnroll()
[void]$sb.AppendLine("Total enrolls found: $($enrolls.Count)")

# Filter for Salvin Ramesh (DIN = 27)
$salvinEnrolls = $enrolls | Where-Object { $_.DIN -eq 27 }
[void]$sb.AppendLine("Salvin Ramesh (DIN = 27) enrolls count: $($salvinEnrolls.Count)")

foreach ($e in $salvinEnrolls) {
    $fpHex = ""
    if ($e.Fingerprint -ne $null) {
        # Fingerprint is a byte array
        $fpBytes = [byte[]]$e.Fingerprint
        $fpHex = [System.Convert]::ToBase64String($fpBytes)
    }
    [void]$sb.AppendLine("Enroll ID: $($e.DIN) | BackupNumber: $($e.BackupNumber) | Privilege: $($e.Privilege) | UserName: $($e.UserName) | Enable: $($e.Enable) | Fingerprint (Base64): $fpHex")
}

$device.CloseDevice()
[void]$sb.AppendLine("Device connection closed.")

[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
