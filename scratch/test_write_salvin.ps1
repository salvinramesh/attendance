$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\test_write_salvin_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING INDIVIDUAL WRITE TEST FOR SALVIN WITH CORRECT CHECKSUM ===")

$cmd = {
    $ErrorActionPreference = "Stop"
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

    # Get templates from RAMS DB for DIN 27
    $conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\RAMS\Database\RAS.mdb;Jet OLEDB:Database Password=ras258;")
    $conn.Open()
    $dbCmd = $conn.CreateCommand()
    $dbCmd.CommandText = "SELECT BackupNumber, Fingerprint FROM ras_Enroll WHERE DIN = 27 AND BackupNumber <= 9"
    $reader = $dbCmd.ExecuteReader()
    $localTemplates = @()
    while ($reader.Read()) {
        $bn = [int]$reader["BackupNumber"]
        $fp = $reader["Fingerprint"].ToString()
        $localTemplates += @{
            fingerId = $bn
            template = $fp
        }
    }
    $reader.Close()
    $conn.Close()

    Write-Output "Found $($localTemplates.Count) templates for Salvin in RAMS DB."

    # Connect to Office 2 ZDFinger
    $device = New-Object RealandAPI.ZDFinger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.74"
    $device.IpPort = 5550
    $device.DN = 1
    $device.Password = 0

    if (-not $device.OpenDevice()) {
        throw "Failed to connect to scanner!"
    }
    Write-Output "Scanner connected."

    foreach ($t in $localTemplates) {
        $fingerId = $t.fingerId
        $fpStr = $t.template
        
        Write-Output "Processing finger $fingerId..."

        # Parse short template string to byte array
        $chunks = $fpStr -split ' '
        $bytesList = New-Object System.Collections.Generic.List[Byte]
        foreach ($chunk in $chunks) {
            $val = [System.Convert]::ToUInt32($chunk, 16)
            $chunkBytes = [System.BitConverter]::GetBytes($val)
            $bytesList.AddRange($chunkBytes)
        }
        $shortBytes = $bytesList.ToArray()

        # Pad to 800 bytes
        $paddedBytes = New-Object Byte[] 800
        [System.Array]::Copy($shortBytes, $paddedBytes, $shortBytes.Length)

        # Convert to 1000-byte long message
        $longBytes = $device.ConvertToLongMessage($paddedBytes)
        if ($longBytes -eq $null -or $longBytes.Length -ne 1000) {
            throw "Failed to convert short template to 1000-byte long template for finger $fingerId"
        }

        # Construct 1416-byte template array
        $templateBytes = New-Object Byte[] 1416
        
        # Header (Bytes 0-7: "SmackBio")
        $headerMagic = [byte[]]@(0x53, 0x6d, 0x61, 0x63, 0x6b, 0x42, 0x69, 0x6f)
        [System.Array]::Copy($headerMagic, $templateBytes, 8)

        # DIN (Bytes 8-11)
        $dinBytes = [System.BitConverter]::GetBytes([uint32]27)
        [System.Array]::Copy($dinBytes, 0, $templateBytes, 8, 4)

        # Word 3 (Bytes 12-15)
        $word3Bytes = [byte[]]@(0x01, 0x00, 0x00, 0x00)
        [System.Array]::Copy($word3Bytes, 0, $templateBytes, 12, 4)

        # Biometric template data (Bytes 16-1015)
        [System.Array]::Copy($longBytes, 0, $templateBytes, 16, 1000)

        # Calculate checksum ONLY over bytes 16 to 1295 (Biometric template + padding)
        $chkSum = 0
        for ($i = 16; $i -lt 1296; $i++) {
            $chkSum += $templateBytes[$i]
        }
        $templateBytes[15] = $chkSum % 256

        # Convert to space-separated hex words
        $words = @()
        for ($i = 0; $i -lt $templateBytes.Length; $i += 4) {
            $wVal = [System.BitConverter]::ToUInt32($templateBytes, $i)
            $words += "{0:X8}" -f $wVal
        }
        $longFpStr = $words -join " "

        # Enroll object
        $enroll = New-Object RealandAPI.Enroll
        $enroll.DN = 1
        $enroll.DIN = [uint64]27
        $enroll.BackupNumber = $fingerId
        $enroll.Privilege = 0
        $enroll.Fingerprint = $longFpStr
        $enroll.Enable = $true
        $enroll.UserName = "SALVIN RAMESH"
        $enroll.ValidDate = [DateTime]"2026-01-01 00:00:00"
        $enroll.InvalidDate = [DateTime]"2099-12-31 23:59:59"
        $enroll.Password = [uint32]0

        $setRes = $device.SetEnroll($enroll)
        Write-Output "SetEnroll for finger $($fingerId): $setRes"
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
