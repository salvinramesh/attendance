$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\shorten_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING SHORTEN TEST ===")

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
        Write-Output "Retrieved long fingerprint. Length of string: $($fpStr.Length)"

        # Parse string to 1412-byte array
        $chunks = $fpStr -split ' '
        $bytesList = New-Object System.Collections.Generic.List[Byte]
        foreach ($chunk in $chunks) {
            $val = [System.Convert]::ToUInt32($chunk, 16)
            $chunkBytes = [System.BitConverter]::GetBytes($val)
            $bytesList.AddRange($chunkBytes)
        }
        $longBytes = $bytesList.ToArray()
        Write-Output "Parsed long bytes. Length: $($longBytes.Length)"

        # Test ConvertToShortMessage
        $shortBytes = $device.ConvertToShortMessage($longBytes)
        if ($shortBytes -ne $null) {
            Write-Output "ConvertToShortMessage returned byte array of length: $($shortBytes.Length)"
            
            # Convert to space-separated hex words
            $words = @()
            for ($i = 0; $i -lt $shortBytes.Length; $i += 4) {
                $val = [System.BitConverter]::ToUInt32($shortBytes, $i)
                $words += "{0:X8}" -f $val
            }
            $shortStr = $words -join " "
            Write-Output "Generated short string. Length: $($shortStr.Length)"
            Write-Output "Short snippet: $shortStr"

            # Try converting back to long
            $backToLongBytes = $device.ConvertToLongMessage($shortBytes)
            if ($backToLongBytes -ne $null) {
                Write-Output "Successfully converted back! Long length: $($backToLongBytes.Length)"
            } else {
                Write-Output "Failed to convert back to long (returned null)!"
            }
        } else {
            Write-Output "ConvertToShortMessage returned null!"
        }
    } else {
        Write-Error "Failed to retrieve user 12 enrollment!"
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
