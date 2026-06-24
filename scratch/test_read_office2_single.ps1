$dllPath = "D:\RIMS\RealandAPI.dll"
$rissDllPath = "D:\RIMS\Riss.Devices.dll"

# Load in correct order
[System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

$outputFile = "C:\RAMS\read_office2_single.txt"
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

# Try GetEnroll for DIN 12, finger 0 to 9
for ($f = 0; $f -le 9; $f++) {
    $e = New-Object RealandAPI.Enroll
    $e.DN = 1
    $e.DIN = [uint64]12
    $e.BackupNumber = $f
    
    try {
        $res = $device.GetEnroll($e)
        if ($res -and $e.Fingerprint -ne $null) {
            $fp = $e.Fingerprint
            $fpStr = $fp.ToString()
            [void]$sb.AppendLine("GetEnroll Success for DIN 12, finger $f! Type: $($fp.GetType().FullName) | Length: $($fpStr.Length)")
        }
    } catch {
        [void]$sb.AppendLine("Error on finger $f - $_")
    }
}

# Try GetEnroll for DIN 86, finger 0 to 9
for ($f = 0; $f -le 9; $f++) {
    $e = New-Object RealandAPI.Enroll
    $e.DN = 1
    $e.DIN = [uint64]86
    $e.BackupNumber = $f
    
    try {
        $res = $device.GetEnroll($e)
        if ($res -and $e.Fingerprint -ne $null) {
            $fp = $e.Fingerprint
            $fpStr = $fp.ToString()
            [void]$sb.AppendLine("GetEnroll Success for DIN 86, finger $f! Type: $($fp.GetType().FullName) | Length: $($fpStr.Length)")
        }
    } catch {
        [void]$sb.AppendLine("Error on finger $f - $_")
    }
}

$device.CloseDevice()
[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
