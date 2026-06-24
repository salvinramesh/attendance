$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\rims_checksums_dump.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== DUMPING RIMS TEMPLATE CHECKSUMS ===")

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
    Write-Output "Connected to Office 2 device."

    $enrolls = $device.GetAllEnroll()
    Write-Output "Retrieved $($enrolls.Count) enrollments."

    # Helper to parse space-separated hex words to Byte[]
    $parseHex = {
        param($hexStr)
        $chunks = $hexStr -split ' '
        $bytesList = New-Object System.Collections.Generic.List[Byte]
        foreach ($chunk in $chunks) {
            $val = [System.Convert]::ToUInt32($chunk, 16)
            $chunkBytes = [System.BitConverter]::GetBytes($val)
            $bytesList.AddRange($chunkBytes)
        }
        return $bytesList.ToArray()
    }

    foreach ($e in $enrolls) {
        if ($e.Fingerprint -ne $null -and $e.Fingerprint.ToString().Length -gt 10) {
            $fpStr = $e.Fingerprint.ToString()
            $bytes = &$parseHex $fpStr

            $din = $e.DIN
            $backupNo = $e.BackupNumber
            $userName = $e.UserName

            # Byte 12, 13, 14, 15
            $b12 = $bytes[12]
            $b13 = $bytes[13]
            $b14 = $bytes[14]
            $b15 = $bytes[15] # Checksum byte

            # Sum of biometric bytes 16 to 1015
            $bioSum = 0
            for ($i = 16; $i -lt 1016; $i++) {
                $bioSum += $bytes[$i]
            }

            # Sum of all bytes excluding index 15
            $allSum = 0
            for ($i = 0; $i -lt $bytes.Length; $i++) {
                if ($i -eq 15) { continue }
                $allSum += $bytes[$i]
            }

            Write-Output "DIN: $din | Backup: $backupNo | Name: $userName | B12-15: $b12, $b13, $b14, $b15 | BioSum: $bioSum (Mod256: $($bioSum % 256)) | AllSum: $allSum (Mod256: $($allSum % 256))"
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
