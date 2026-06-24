$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\write_existing_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING WRITE EXISTING TEST ===")

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
    Write-Output "Device connected."

    # 1. Fetch user 12 enrollment
    $e12 = New-Object RealandAPI.Enroll
    $e12.DN = 1
    $e12.DIN = [uint64]12
    $e12.BackupNumber = 0
    $res12 = $device.GetEnroll($e12)
    Write-Output "GetEnroll DIN 12: $res12"

    if ($res12 -and $e12.Fingerprint -ne $null) {
        $fpStr = $e12.Fingerprint.ToString()
        Write-Output "DIN 12 template length: $($fpStr.Length)"
        Write-Output "Original Word 0-3: $($fpStr.Substring(0, 35))"

        # 2. Try writing to DIN 99 using exact same string (test if it works or if scanner rejects mismatch)
        $enroll99 = New-Object RealandAPI.Enroll
        $enroll99.DN = 1
        $enroll99.DIN = [uint64]99
        $enroll99.BackupNumber = 0
        $enroll99.Privilege = 0
        $enroll99.Fingerprint = $fpStr
        $enroll99.Enable = $true
        $enroll99.UserName = "TEST USER 99"
        $enroll99.ValidDate = [DateTime]"2026-01-01 00:00:00"
        $enroll99.InvalidDate = [DateTime]"2099-12-31 23:59:59"
        $enroll99.Password = [uint32]0

        $res99_exact = $device.SetEnroll($enroll99)
        Write-Output "SetEnroll DIN 99 (exact string): $res99_exact"

        # 3. Try writing to DIN 99 with modified DIN in Word 2 (but original Word 3)
        $words = $fpStr -split ' '
        $words[2] = "00000063" # 99 in hex (big endian hex representation)
        $fpStr_mod1 = $words -join ' '

        $enroll99.Fingerprint = $fpStr_mod1
        $res99_mod1 = $device.SetEnroll($enroll99)
        Write-Output "SetEnroll DIN 99 (modified DIN, original Word 3): $res99_mod1"

        # 4. Try writing to DIN 99 with modified DIN in Word 2 and modified Word 3 (incremented/decremented?)
        # Let's try various values for Word 3 first byte.
        # Wait, what if Word 3 is indeed a checksum?
        # Let's write a loop to try first byte of Word 3 from 0x00 to 0xFF?
        # No, that's 256 attempts, it will take too long.
        # Let's print out what is returned by GetEnroll for DIN 99 if either SetEnroll succeeded.
        if ($res99_exact -or $res99_mod1) {
            $e99 = New-Object RealandAPI.Enroll
            $e99.DN = 1
            $e99.DIN = [uint64]99
            $e99.BackupNumber = 0
            $getRes = $device.GetEnroll($e99)
            Write-Output "GetEnroll DIN 99 success: $getRes"
            if ($getRes -and $e99.Fingerprint -ne $null) {
                $retStr = $e99.Fingerprint.ToString()
                Write-Output "Retrieved DIN 99 Word 0-3: $($retStr.Substring(0, 35))"
            }
            # Delete DIN 99
            $device.DelEnroll($enroll99, $true) | Out-Null
            Write-Output "Deleted temporary DIN 99"
        }
    }

    $device.CloseDevice()
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
