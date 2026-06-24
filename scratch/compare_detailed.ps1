$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\compare_detailed_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING DETAILED COMPARE ===")

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

    # DIN 12
    $e12 = New-Object RealandAPI.Enroll
    $e12.DN = 1
    $e12.DIN = [uint64]12
    $e12.BackupNumber = 0
    $device.GetEnroll($e12) | Out-Null

    # DIN 86
    $e86 = New-Object RealandAPI.Enroll
    $e86.DN = 1
    $e86.DIN = [uint64]86
    $e86.BackupNumber = 0
    $device.GetEnroll($e86) | Out-Null

    $device.CloseDevice()

    # Parse to bytes
    $parse = {
        param($fpStr)
        $chunks = $fpStr -split ' '
        $bytesList = New-Object System.Collections.Generic.List[Byte]
        foreach ($chunk in $chunks) {
            $val = [System.Convert]::ToUInt32($chunk, 16)
            $chunkBytes = [System.BitConverter]::GetBytes($val)
            $bytesList.AddRange($chunkBytes)
        }
        return $bytesList.ToArray()
    }

    $b12 = &$parse $e12.Fingerprint.ToString()
    $b86 = &$parse $e86.Fingerprint.ToString()

    Write-Output "b12 length: $($b12.Length), b86 length: $($b86.Length)"

    # Print first 64 bytes of both side-by-side in hex
    Write-Output "First 64 bytes:"
    for ($i = 0; $i -lt 64; $i += 4) {
        $w12 = [System.BitConverter]::ToUInt32($b12, $i)
        $w86 = [System.BitConverter]::ToUInt32($b86, $i)
        Write-Output ("Offset {0:D2} | b12: {1:X8} | b86: {2:X8}" -f $i, $w12, $w86)
    }

    # Find all differences
    $diffs = 0
    for ($i = 0; $i -lt $b12.Length; $i++) {
        if ($b12[$i] -ne $b86[$i]) {
            $diffs++
            if ($diffs -le 20) {
                Write-Output ("Diff at byte {0} (0x{0:X3}) | b12: 0x{1:X2} ({1}) | b86: 0x{2:X2} ({2})" -f $i, $b12[$i], $b86[$i])
            }
        }
    }
    Write-Output "Total differences: $diffs"
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

[System.IO.File]::WriteAllText($logFile, $sb.ToString())
Write-Output "Results written to $logFile"
