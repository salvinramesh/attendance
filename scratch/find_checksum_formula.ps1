$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\checksum_formula_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== SEARCHING FOR CHECKSUM FORMULA ===")

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

    # Fetch DIN 12
    $e12 = New-Object RealandAPI.Enroll
    $e12.DN = 1
    $e12.DIN = [uint64]12
    $e12.BackupNumber = 0
    $res12 = $device.GetEnroll($e12)
    if (-not $res12) { throw "Failed to get DIN 12" }
    $bytes12 = &$parseHex $e12.Fingerprint.ToString()

    # Fetch DIN 86
    $e86 = New-Object RealandAPI.Enroll
    $e86.DN = 1
    $e86.DIN = [uint64]86
    $e86.BackupNumber = 0
    $res86 = $device.GetEnroll($e86)
    if (-not $res86) { throw "Failed to get DIN 86" }
    $bytes86 = &$parseHex $e86.Fingerprint.ToString()

    $device.CloseDevice()

    Write-Output "Successfully retrieved templates for DIN 12 and DIN 86."

    # Let's inspect the target checksum bytes
    $chk12 = $bytes12[15]
    $chk86 = $bytes86[15]
    Write-Output "DIN 12 Checksum: $chk12 (0x$("{0:X2}" -f $chk12))"
    Write-Output "DIN 86 Checksum: $chk86 (0x$("{0:X2}" -f $chk86))"

    # We want to find a function f(bytes, din) such that:
    # f(bytes12, 12) = 43 AND f(bytes86, 86) = 44

    # Let's try different ranges and functions
    # Range 1: Biometric data (bytes 16 to 1015)
    # Range 2: All bytes (bytes 0 to 1415, with byte 15 set to 0)
    # Range 3: First 16 bytes (header, DIN, Word 3 except checksum)
    # Range 4: Just the DIN (bytes 8-11)
    
    # Let's write a function to test a candidate checksum calculation
    $testFormula = {
        param($name, $calcFn)
        $val12 = &$calcFn $bytes12 12
        $val86 = &$calcFn $bytes86 86
        if ($val12 -eq $chk12 -and $val86 -eq $chk86) {
            Write-Output "FOUND WORKING FORMULA: $name"
        } else {
            # Write-Output "Tested $name: 12=>$val12 (expected $chk12), 86=>$val86 (expected $chk86)"
        }
    }

    # 1. Check sum of bytes of biometric data
    &$testFormula "Sum of bio bytes % 256" {
        param($b, $d)
        $sum = 0
        for ($i = 16; $i -lt 1016; $i++) { $sum += $b[$i] }
        return $sum % 256
    }

    # 2. Check sum of all bytes except index 15
    &$testFormula "Sum of all bytes % 256" {
        param($b, $d)
        $sum = 0
        for ($i = 0; $i -lt $b.Length; $i++) {
            if ($i -eq 15) { continue }
            $sum += $b[$i]
        }
        return $sum % 256
    }

    # 3. Sum of DIN bytes
    &$testFormula "Sum of DIN bytes + Constant" {
        param($b, $d)
        # DIN is at bytes 8-11. For 12, it is 12, 0, 0, 0. For 86, it is 86, 0, 0, 0.
        # Checksum 12 is 43. Checksum 86 is 44.
        # This implies it might not be a simple linear sum of DIN since 86 - 12 = 74, but 44 - 43 = 1.
        # Wait, what if the checksum is:
        # Checksum = (Sum of all bytes of the 1416-byte template) % 256?
        # But wait! If we wrote the template with byte 15 set to 0, did the device write it and then return a different checksum when retrieved?
        # Wait! Let's check what the device returned for DIN 99 in test_write_converted!
        # In task-11620, the retrieved snippet for DIN 99 was:
        # 63616D53 6F69426B 00000063 00000001 ...
        # Wait! Word 3 was 00000001! That means byte 15 was 0x00!
        # So the device did NOT change the checksum byte when we wrote it! It just stored whatever we wrote!
        # BUT does the device matching engine fail to match because the checksum is wrong?
        # Yes! That explains why the device accepts it, but doesn't recognize it.
        return 0
    }

    # Let's print out the first 32 bytes of both templates for close comparison
    Write-Output "DIN 12 header: $(($bytes12[0..31] | ForEach-Object { '{0:X2}' -f $_ }) -join ' ')"
    Write-Output "DIN 86 header: $(($bytes86[0..31] | ForEach-Object { '{0:X2}' -f $_ }) -join ' ')"

    # Let's calculate the sum of the 1000 bytes of the biometric template for both:
    $sum12 = 0; for ($i = 16; $i -lt 1016; $i++) { $sum12 += $bytes12[$i] }
    $sum86 = 0; for ($i = 16; $i -lt 1016; $i++) { $sum86 += $bytes86[$i] }
    Write-Output "DIN 12 BioSum: $sum12"
    Write-Output "DIN 86 BioSum: $sum86"

    # Wait, is the checksum calculated as:
    # Checksum = (DIN + backupNumber + privilege + Enable + validDate + invalidDate + ...) ?
    # Let's check the properties of Enroll for both:
    # DIN 12 properties:
    # DIN 86 properties:
    # Let's inspect properties of Enroll 12 and 86
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
