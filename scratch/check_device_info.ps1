$ErrorActionPreference = "Continue"

$logFile = "C:\RAMS\device_info_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== SCANNING DEVICE INFO ===")

# 1. Check Office 1 (RAMS) in a sub-process
$cmd1 = {
    $ErrorActionPreference = "Continue"
    Set-Location "C:\RAMS"
    [System.Reflection.Assembly]::LoadFrom("C:\RAMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("C:\RAMS\RealandAPI.dll") | Out-Null

    $dev1 = New-Object RealandAPI.ZDC2911Finger
    $dev1.Communication = 1
    $dev1.IpAddress = "192.168.5.61"
    $dev1.IpPort = 5500
    $dev1.DN = 2
    $dev1.Password = 0

    Write-Output "--- Office 1 (RAMS) ---"
    if ($dev1.OpenDevice()) {
        Write-Output "Connected successfully."
        try { Write-Output "Model: $($dev1.Model)" } catch {}
        try { Write-Output "Product Code: $($dev1.GetProductCode())" } catch {}
        $dev1.CloseDevice()
    } else {
        Write-Output "Failed to connect."
    }
}

# 2. Check Office 2 (RIMS) in a sub-process
$cmd2 = {
    $ErrorActionPreference = "Continue"
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

    $dev2 = New-Object RealandAPI.ZDFinger
    $dev2.Communication = 1
    $dev2.IpAddress = "192.168.5.74"
    $dev2.IpPort = 5550
    $dev2.DN = 1
    $dev2.Password = 0

    Write-Output "--- Office 2 (RIMS) ---"
    if ($dev2.OpenDevice()) {
        Write-Output "Connected successfully."
        try { Write-Output "Model: $($dev2.Model)" } catch {}
        try { Write-Output "Product Code: $($dev2.GetProductCode())" } catch {}
        $dev2.CloseDevice()
    } else {
        Write-Output "Failed to connect."
    }
}

try {
    $output1 = powershell -NoProfile -ExecutionPolicy Bypass -Command $cmd1
    [void]$sb.AppendLine("Office 1 Output:")
    foreach ($line in $output1) {
        [void]$sb.AppendLine("  $line")
    }
} catch {
    [void]$sb.AppendLine("Office 1 Failed: $_")
}

try {
    $output2 = powershell -NoProfile -ExecutionPolicy Bypass -Command $cmd2
    [void]$sb.AppendLine("Office 2 Output:")
    foreach ($line in $output2) {
        [void]$sb.AppendLine("  $line")
    }
} catch {
    [void]$sb.AppendLine("Office 2 Failed: $_")
}

[System.IO.File]::WriteAllText($logFile, $sb.ToString())
Write-Output "Results written to $logFile"
