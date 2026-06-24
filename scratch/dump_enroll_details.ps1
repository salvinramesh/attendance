$dllPath = "C:\RAMS\RealandAPI.dll"
$rissDllPath = "C:\RAMS\Riss.Devices.dll"

# Load in correct order
[System.Reflection.Assembly]::LoadFile($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFile($dllPath) | Out-Null

$outputFile = "C:\RAMS\dump_enroll_results.txt"
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

# 1. Test GetAllEnroll
$enrolls = $device.GetAllEnroll()
$salvinEnrolls = $enrolls | Where-Object { $_.DIN -eq 27 }
[void]$sb.AppendLine("=== GetAllEnroll results for DIN 27 ===")
foreach ($e in $salvinEnrolls) {
    [void]$sb.AppendLine("DIN: $($e.DIN)")
    [void]$sb.AppendLine("BackupNumber: $($e.BackupNumber)")
    [void]$sb.AppendLine("Privilege: $($e.Privilege)")
    [void]$sb.AppendLine("UserName: $($e.UserName)")
    [void]$sb.AppendLine("Enable: $($e.Enable)")
    $fp = $e.Fingerprint
    [void]$sb.AppendLine("Fingerprint type: $(if ($fp -ne $null) { $fp.GetType().FullName } else { 'Null' })")
    if ($fp -ne $null) {
        $fpBytes = [byte[]]$fp
        [void]$sb.AppendLine("Fingerprint length: $($fpBytes.Length)")
    }
    
    # Dump all properties dynamically
    $e | Get-Member -MemberType Property | ForEach-Object {
        $propName = $_.Name
        $propVal = $e.$propName
        [void]$sb.AppendLine("  Property $propName = $propVal")
    }
}

# 2. Test GetAllEnrollO
$enrollsO = $device.GetAllEnrollO()
$salvinEnrollsO = $enrollsO | Where-Object { $_.DIN -eq 27 }
[void]$sb.AppendLine("=== GetAllEnrollO results for DIN 27 ===")
foreach ($e in $salvinEnrollsO) {
    [void]$sb.AppendLine("DIN: $($e.DIN)")
    [void]$sb.AppendLine("BackupNumber: $($e.BackupNumber)")
    $fp = $e.Fingerprint
    [void]$sb.AppendLine("Fingerprint type: $(if ($fp -ne $null) { $fp.GetType().FullName } else { 'Null' })")
    if ($fp -ne $null) {
        $fpBytes = [byte[]]$fp
        [void]$sb.AppendLine("Fingerprint length: $($fpBytes.Length)")
    }
    
    # Dump all properties dynamically
    $e | Get-Member -MemberType Property | ForEach-Object {
        $propName = $_.Name
        $propVal = $e.$propName
        [void]$sb.AppendLine("  Property $propName = $propVal")
    }
}

# 3. Test GetEnroll (passing reference list)
$list = New-Object 'System.Collections.Generic.List[RealandAPI.Enroll]'
$getEnrollRes = $device.GetEnroll([ref]$list)
[void]$sb.AppendLine("=== GetEnroll result: $getEnrollRes ===")
[void]$sb.AppendLine("GetEnroll list count: $($list.Count)")
$salvinEnrollsList = $list | Where-Object { $_.DIN -eq 27 }
foreach ($e in $salvinEnrollsList) {
    [void]$sb.AppendLine("List DIN: $($e.DIN) | BackupNumber: $($e.BackupNumber)")
    $fp = $e.Fingerprint
    if ($fp -ne $null) {
        $fpBytes = [byte[]]$fp
        [void]$sb.AppendLine("List Fingerprint length: $($fpBytes.Length)")
    }
}

$device.CloseDevice()
[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
