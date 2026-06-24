$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\write_0_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING WRITE 0 TEST ===")

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
    
    if (-not $res12 -or $e12.Fingerprint -eq $null) {
        Write-Error "Failed to retrieve user 12 enrollment!"
    }

    $fpStr = $e12.Fingerprint.ToString()
    
    # Parse template string to byte array
    $parse = {
        param($str)
        $chunks = $str -split ' '
        $bytesList = New-Object System.Collections.Generic.List[Byte]
        foreach ($chunk in $chunks) {
            $val = [System.Convert]::ToUInt32($chunk, 16)
            $chunkBytes = [System.BitConverter]::GetBytes($val)
            $bytesList.AddRange($chunkBytes)
        }
        return $bytesList.ToArray()
    }

    $bytes = &$parse $fpStr

    # 2. Modify the DIN field to 99 (at bytes 8-11, little endian: 0x63, 0x00, 0x00, 0x00)
    $bytes[8] = 99
    $bytes[9] = 0
    $bytes[10] = 0
    $bytes[11] = 0

    # Set byte 15 to 0x00
    $bytes[15] = 0

    # Convert bytes back to space-separated hex words
    $words = @()
    for ($i = 0; $i -lt $bytes.Length; $i += 4) {
        $wVal = [System.BitConverter]::ToUInt32($bytes, $i)
        $words += "{0:X8}" -f $wVal
    }
    $testFpStr = $words -join " "

    $enroll99 = New-Object RealandAPI.Enroll
    $enroll99.DN = 1
    $enroll99.DIN = [uint64]99
    $enroll99.BackupNumber = 0
    $enroll99.Privilege = 0
    $enroll99.Enable = $true
    $enroll99.UserName = "TEST USER 99"
    $enroll99.ValidDate = [DateTime]"2026-01-01 00:00:00"
    $enroll99.InvalidDate = [DateTime]"2099-12-31 23:59:59"
    $enroll99.Password = [uint32]0
    $enroll99.Fingerprint = $testFpStr

    $setRes = $device.SetEnroll($enroll99)
    Write-Output "SetEnroll result: $setRes"

    # Retrieve back to verify and check Word 0-3
    if ($setRes) {
        $e99 = New-Object RealandAPI.Enroll
        $e99.DN = 1
        $e99.DIN = [uint64]99
        $e99.BackupNumber = 0
        if ($device.GetEnroll($e99)) {
            Write-Output "Successfully retrieved DIN 99."
            $retStr = $e99.Fingerprint.ToString()
            Write-Output "Retrieved Word 0-3: $($retStr.Substring(0, 35))"
        }
        # Clean up
        $device.DelEnroll($enroll99, $true) | Out-Null
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
