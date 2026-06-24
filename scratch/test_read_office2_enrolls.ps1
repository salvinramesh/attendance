$dllPath = "D:\RIMS\RealandAPI.dll"
$rissDllPath = "D:\RIMS\Riss.Devices.dll"

# Load in correct order
[System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

$outputFile = "C:\RAMS\read_office2_enrolls.txt"
$sb = New-Object System.Text.StringBuilder

$device = New-Object RealandAPI.ZDFinger
$device.Communication = 1  # TCP/IP
$device.IpAddress = "192.168.5.74"
$device.IpPort = 5550
$device.DN = 1
$device.Password = 0

[void]$sb.AppendLine("Connecting to Office 2 scanner...")
$opened = $device.OpenDevice()
if (-not $opened) {
    [void]$sb.AppendLine("Failed to connect!")
    [System.IO.File]::WriteAllText($outputFile, $sb.ToString())
    exit 1
}
[void]$sb.AppendLine("Connected successfully!")

# Fetch all enrolls
$enrolls = $device.GetAllEnroll()
[void]$sb.AppendLine("Total enrolls found: $($enrolls.Count)")

if ($enrolls.Count -gt 0) {
    # Find first enroll that has fingerprint
    $fpEnroll = $null
    foreach ($e in $enrolls) {
        if ($e.Fingerprint -ne $null) {
            $fpEnroll = $e
            break
        }
    }
    
    if ($fpEnroll -ne $null) {
        $fp = $fpEnroll.Fingerprint
        $fpType = $fp.GetType().FullName
        $fpStr = $fp.ToString()
        [void]$sb.AppendLine("Found user with FP: DIN=$($fpEnroll.DIN) | BackupNumber=$($fpEnroll.BackupNumber)")
        [void]$sb.AppendLine("Fingerprint Type: $fpType")
        [void]$sb.AppendLine("Fingerprint String snippet: $(if ($fpStr.Length -gt 40) { $fpStr.Substring(0, 40) + '...' } else { $fpStr })")
    } else {
        [void]$sb.AppendLine("No users found with fingerprint templates on Office 2!")
    }
}

$device.CloseDevice()
[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
