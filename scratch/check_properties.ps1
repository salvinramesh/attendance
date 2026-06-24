$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\properties_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING PROPERTIES CHECK ===")

$cmd = {
    $ErrorActionPreference = "Stop"
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

    $device = New-Object RealandAPI.ZDFinger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.74"
    $device.IpPort = 5550
    $device.DN = 1
    $device.Password = 0

    $device.OpenDevice() | Out-Null
    
    $e = New-Object RealandAPI.Enroll
    $e.DN = 1
    $e.DIN = [uint64]12
    $e.BackupNumber = 0
    
    $res = $device.GetEnroll($e)
    $device.CloseDevice()

    if ($res) {
        Write-Output "GetEnroll Success!"
        Write-Output "DN: $($e.DN)"
        Write-Output "DIN: $($e.DIN)"
        Write-Output "BackupNumber: $($e.BackupNumber)"
        Write-Output "Privilege: $($e.Privilege)"
        Write-Output "Password: $($e.Password)"
        Write-Output "UserName: $($e.UserName)"
        Write-Output "Enable: $($e.Enable)"
        Write-Output "ValidDate: $($e.ValidDate.ToString('yyyy-MM-dd HH:mm:ss'))"
        Write-Output "InvalidDate: $($e.InvalidDate.ToString('yyyy-MM-dd HH:mm:ss'))"
        Write-Output "TimeAccessZone: $($e.TimeAccessZone)"
        Write-Output "UnlockGroup: $($e.UnlockGroup)"
        Write-Output "UserExtInfo: $($e.UserExtInfo)"
        Write-Output "Fingerprint Length: $(if ($e.Fingerprint -ne $null) { $e.Fingerprint.ToString().Length } else { 'null' })"
    } else {
        Write-Error "GetEnroll failed!"
    }
}

try {
    $output = powershell -NoProfile -ExecutionPolicy Bypass -Command $cmd
    [void]$sb.AppendLine("Output:")
    foreach ($line in $output) {
        [void]$sb.AppendLine("  $line")
    }
} catch {
    [void]$sb.AppendLine("Failed: $_")
}

[void]$sb.AppendLine("=== TEST COMPLETE ===")
[System.IO.File]::WriteAllText($logFile, $sb.ToString())
Write-Output "Results written to $logFile"
