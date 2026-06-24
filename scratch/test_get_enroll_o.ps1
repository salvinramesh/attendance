$dllPath = "C:\RAMS\RealandAPI.dll"
$rissDllPath = "C:\RAMS\Riss.Devices.dll"

# Load in correct order
[System.Reflection.Assembly]::LoadFile($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFile($dllPath) | Out-Null

$outputFile = "C:\RAMS\get_enroll_o_results.txt"
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
    [void]$sb.AppendLine("Failed to connect!")
    [System.IO.File]::WriteAllText($outputFile, $sb.ToString())
    exit 1
}
[void]$sb.AppendLine("Connected!")

# Test GetEnrollO by pre-populating target enrolls
$list = New-Object 'System.Collections.Generic.List[RealandAPI.Enroll]'

# Create request enrollments for DIN 27 for fingers 0 to 9, password (10), and card (11)
for ($f = 0; $f -le 11; $f++) {
    $e = New-Object RealandAPI.Enroll
    $e.DN = 2
    $e.DIN = [uint64]27
    $e.BackupNumber = $f
    $list.Add($e)
}

try {
    [void]$sb.AppendLine("Calling GetEnrollO with populated list...")
    $res = $device.GetEnrollO([ref]$list)
    [void]$sb.AppendLine("GetEnrollO result: $res")
    [void]$sb.AppendLine("Returned List count: $($list.Count)")
    
    foreach ($e in $list) {
        $fp = $e.Fingerprint
        $fpStr = if ($fp -ne $null) { $fp.ToString() } else { "Null" }
        [void]$sb.AppendLine("DIN: $($e.DIN) | BackupNumber: $($e.BackupNumber) | Username: $($e.UserName) | FP Length: $($fpStr.Length) | FP String snippet: $(if ($fpStr.Length -gt 40) { $fpStr.Substring(0, 40) + '...' } else { $fpStr })")
    }
} catch {
    [void]$sb.AppendLine("Error calling GetEnrollO: $_")
}

$device.CloseDevice()
[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
