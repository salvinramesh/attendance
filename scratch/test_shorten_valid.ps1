$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\shorten_valid_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING VALID SHORTEN TEST ===")

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
    
    # 1. Fetch user 12
    $e = New-Object RealandAPI.Enroll
    $e.DN = 1
    $e.DIN = [uint64]12
    $e.BackupNumber = 0
    $res = $device.GetEnroll($e)
    
    if (-not $res) {
        Write-Error "Failed to retrieve user 12 enrollment initially!"
    }

    Write-Output "Initial ValidDate: $($e.ValidDate.ToString('yyyy-MM-dd HH:mm:ss'))"
    Write-Output "Initial InvalidDate: $($e.InvalidDate.ToString('yyyy-MM-dd HH:mm:ss'))"

    # 2. Update validity dates to valid values
    $e.ValidDate = [DateTime]"2026-01-01 00:00:00"
    $e.InvalidDate = [DateTime]"2099-12-31 23:59:59"
    
    Write-Output "Saving updated enrollment to device..."
    $setRes = $device.SetEnroll($e)
    Write-Output "SetEnroll result: $setRes"

    # 3. Retrieve it back
    $e2 = New-Object RealandAPI.Enroll
    $e2.DN = 1
    $e2.DIN = [uint64]12
    $e2.BackupNumber = 0
    $res2 = $device.GetEnroll($e2)
    $device.CloseDevice()

    if ($res2 -and $e2.Fingerprint -ne $null) {
        Write-Output "Successfully retrieved updated enrollment!"
        Write-Output "Updated ValidDate: $($e2.ValidDate.ToString('yyyy-MM-dd HH:mm:ss'))"
        Write-Output "Updated InvalidDate: $($e2.InvalidDate.ToString('yyyy-MM-dd HH:mm:ss'))"

        # Parse updated template string to byte array
        $fpStr = $e2.Fingerprint.ToString()
        $chunks = $fpStr -split ' '
        $bytesList = New-Object System.Collections.Generic.List[Byte]
        foreach ($chunk in $chunks) {
            $val = [System.Convert]::ToUInt32($chunk, 16)
            $chunkBytes = [System.BitConverter]::GetBytes($val)
            $bytesList.AddRange($chunkBytes)
        }
        $longBytes = $bytesList.ToArray()
        Write-Output "Long bytes length: $($longBytes.Length)"

        # Test ConvertToShortMessage
        try {
            $shortBytes = $device.ConvertToShortMessage($longBytes)
            if ($shortBytes -ne $null) {
                Write-Output "ConvertToShortMessage Success! Short bytes length: $($shortBytes.Length)"
                
                $words = @()
                for ($i = 0; $i -lt $shortBytes.Length; $i += 4) {
                    $val = [System.BitConverter]::ToUInt32($shortBytes, $i)
                    $words += "{0:X8}" -f $val
                }
                $shortStr = $words -join " "
                Write-Output "Short string length: $($shortStr.Length)"
                Write-Output "Short snippet: $shortStr"
            } else {
                Write-Output "ConvertToShortMessage returned null!"
            }
        } catch {
            Write-Output "ConvertToShortMessage threw exception: $_"
        }
    } else {
        Write-Error "Failed to retrieve updated enrollment from device!"
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
