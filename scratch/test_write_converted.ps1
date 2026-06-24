$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\write_converted_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING WRITE CONVERTED TEST ===")

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

    # Get short template from RAMS DB for DIN 27
    $conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\RAMS\Database\RAS.mdb;Jet OLEDB:Database Password=ras258;")
    $conn.Open()
    $dbCmd = $conn.CreateCommand()
    $dbCmd.CommandText = "SELECT Fingerprint FROM ras_Enroll WHERE DIN = 27 AND BackupNumber = 0"
    $fpStr = $dbCmd.ExecuteScalar().ToString()
    $conn.Close()

    # Parse short template string to byte array (500 bytes)
    $chunks = $fpStr -split ' '
    $bytesList = New-Object System.Collections.Generic.List[Byte]
    foreach ($chunk in $chunks) {
        $val = [System.Convert]::ToUInt32($chunk, 16)
        $chunkBytes = [System.BitConverter]::GetBytes($val)
        $bytesList.AddRange($chunkBytes)
    }
    $shortBytes = $bytesList.ToArray()
    Write-Output "Original short bytes length: $($shortBytes.Length)"

    # Pad to 800 bytes
    $paddedBytes = New-Object Byte[] 800
    [System.Array]::Copy($shortBytes, $paddedBytes, $shortBytes.Length)

    # Convert to 1000-byte long message
    $longBytes = $device.ConvertToLongMessage($paddedBytes)
    Write-Output "ConvertToLongMessage success. Bytes length: $($longBytes.Length)"

    # Construct the 1416-byte template array
    $templateBytes = New-Object Byte[] 1416
    
    # 1. Header (Bytes 0-7: "SmackBio")
    # "SmackBio" in ASCII is: 53 6d 61 63 6b 42 69 6f
    $headerMagic = [byte[]]@(0x53, 0x6d, 0x61, 0x63, 0x6b, 0x42, 0x69, 0x6f)
    [System.Array]::Copy($headerMagic, $templateBytes, 8)

    # 2. DIN (Bytes 8-11: 32-bit little-endian integer)
    $dinBytes = [System.BitConverter]::GetBytes([uint32]99)
    [System.Array]::Copy($dinBytes, 0, $templateBytes, 8, 4)

    # 3. Word 3 (Bytes 12-15: 01 00 00 00 in little-endian / 00000001 big-endian)
    $word3Bytes = [byte[]]@(0x01, 0x00, 0x00, 0x00)
    [System.Array]::Copy($word3Bytes, 0, $templateBytes, 12, 4)

    # 4. Converted long biometric data (Bytes 16-1015)
    [System.Array]::Copy($longBytes, 0, $templateBytes, 16, 1000)

    # 5. Remaining 400 bytes are padded with zeros (already initialized to 0)

    # Convert 1416 bytes back to space-separated hex words
    $words = @()
    for ($i = 0; $i -lt $templateBytes.Length; $i += 4) {
        $wVal = [System.BitConverter]::ToUInt32($templateBytes, $i)
        $words += "{0:X8}" -f $wVal
    }
    $longFpStr = $words -join " "

    # SetEnroll to device
    $enroll99 = New-Object RealandAPI.Enroll
    $enroll99.DN = 1
    $enroll99.DIN = [uint64]99
    $enroll99.BackupNumber = 0
    $enroll99.Privilege = 0
    $enroll99.Fingerprint = $longFpStr
    $enroll99.Enable = $true
    $enroll99.UserName = "TEST USER 99"
    $enroll99.ValidDate = [DateTime]"2026-01-01 00:00:00"
    $enroll99.InvalidDate = [DateTime]"2099-12-31 23:59:59"
    $enroll99.Password = [uint32]0

    $setRes = $device.SetEnroll($enroll99)
    Write-Output "SetEnroll result: $setRes"

    # Read back to verify
    if ($setRes) {
        $e99 = New-Object RealandAPI.Enroll
        $e99.DN = 1
        $e99.DIN = [uint64]99
        $e99.BackupNumber = 0
        $getRes = $device.GetEnroll($e99)
        Write-Output "GetEnroll result: $getRes"
        if ($getRes -and $e99.Fingerprint -ne $null) {
            $retStr = $e99.Fingerprint.ToString()
            Write-Output "Retrieved fingerprint string length: $($retStr.Length)"
            Write-Output "Retrieved snippet: $($retStr.Substring(0, 100))"
        }
        # Clean up
        $device.DelEnroll($enroll99, $true) | Out-Null
        Write-Output "Cleaned up test enrollment."
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
