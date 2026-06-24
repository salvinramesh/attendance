$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\office2_din12_fp.txt"

$cmd = {
    $ErrorActionPreference = "Stop"
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

    # Connect to Office 2 ZDFinger
    $device = New-Object RealandAPI.ZDFinger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.74"
    $device.IpPort = 5550
    $device.DN = 1
    $device.Password = 0

    $device.OpenDevice() | Out-Null

    # Get enroll for DIN 12
    $e = New-Object RealandAPI.Enroll
    $e.DN = 1
    $e.DIN = [uint64]12
    $e.BackupNumber = 0
    
    $res = $device.GetEnroll($e)
    $device.CloseDevice()

    if ($res -and $e.Fingerprint -ne $null) {
        $fpStr = $e.Fingerprint.ToString()
        Write-Output $fpStr
    } else {
        Write-Error "Failed to retrieve user 12 enrollment!"
    }
}

try {
    $output = powershell -NoProfile -ExecutionPolicy Bypass -Command $cmd
    Set-Content -Path $logFile -Value $output
    Write-Output "Results written to $logFile"
} catch {
    Write-Error "Failed: $_"
}
