$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\active_checksums_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== DUMPING ACTIVE CHECKSUMS ===")

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
    Write-Output "Total enrolls metadata: $($enrolls.Count)"

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

    # Loop through unique DINs to avoid checking same DIN multiple times if not needed
    $dins = $enrolls | Select-Object -ExpandProperty DIN -Unique
    Write-Output "Unique DINs: $($dins.Count)"

    $nonZeroCount = 0
    foreach ($din in $dins) {
        # Check fingers 0, 1, 2
        for ($f = 0; $f -lt 3; $f++) {
            $eObj = New-Object RealandAPI.Enroll
            $eObj.DN = 1
            $eObj.DIN = [uint64]$din
            $eObj.BackupNumber = $f
            
            $res = $device.GetEnroll($eObj)
            if ($res -and $eObj.Fingerprint -ne $null -and $eObj.Fingerprint.ToString().Length -gt 10) {
                $fpStr = $eObj.Fingerprint.ToString()
                $bytes = &$parseHex $fpStr
                $b15 = $bytes[15]
                
                # Sum of biometric bytes 16 to 1015
                $bioSum = 0
                for ($i = 16; $i -lt 1016; $i++) {
                    $bioSum += $bytes[$i]
                }
                
                if ($b15 -gt 0) {
                    Write-Output "FOUND: DIN: $din | Backup: $f | Name: $($eObj.UserName) | Checksum (B15): $b15 | BioSum: $bioSum (Mod256: $($bioSum % 256))"
                    $nonZeroCount++
                    if ($nonZeroCount -ge 10) {
                        break
                    }
                }
            }
        }
        if ($nonZeroCount -ge 10) {
            break
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
