$dllPath = "C:\RAMS\RealandAPI.dll"
[System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

$outputFile = "C:\RAMS\read_office2_results.txt"
$sb = New-Object System.Text.StringBuilder

$device = New-Object RealandAPI.ZDC2911Finger
$device.Communication = 1  # TCP/IP
$device.IpAddress = "192.168.5.74"
$device.IpPort = 5550
$device.DN = 1
$device.Password = 0

[void]$sb.AppendLine("Connecting to Office 2 scanner...")
$opened = $device.OpenDevice()
if (-not $opened) {
    [void]$sb.AppendLine("Failed to connect to Office 2 scanner!")
    [System.IO.File]::WriteAllText($outputFile, $sb.ToString())
    exit 1
}
[void]$sb.AppendLine("Connected to Office 2 scanner successfully!")

# Fetch all enrolls
$enrolls = $device.GetAllEnroll()
[void]$sb.AppendLine("Total enrolls found: $($enrolls.Count)")

if ($enrolls.Count -gt 0) {
    # Print first 5 enrolls
    $count = [Math]::Min(5, $enrolls.Count)
    for ($i = 0; $i -lt $count; $i++) {
        $e = $enrolls[$i]
        $fpHex = ""
        if ($e.Fingerprint -ne $null) {
            $fpBytes = [byte[]]$e.Fingerprint
            $fpHex = [System.Convert]::ToBase64String($fpBytes)
        }
        [void]$sb.AppendLine("Enroll ID: $($e.DIN) | BackupNumber: $($e.BackupNumber) | Privilege: $($e.Privilege) | UserName: $($e.UserName) | Fingerprint length: $($fpBytes.Length)")
    }
}

$device.CloseDevice()
[void]$sb.AppendLine("Device connection closed.")

[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
