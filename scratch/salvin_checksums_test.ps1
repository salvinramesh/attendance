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

$outputFile = "C:\RAMS\salvin_checksums_test.txt"
$sb = New-Object System.Text.StringBuilder

foreach ($t in $localTemplates) {
    $fingerId = $t.fingerId
    $fpStr = $t.template
    
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
    
    # Construct 1416-byte template array
    $templateBytes = New-Object Byte[] 1416
    $headerMagic = [byte[]]@(0x53, 0x6d, 0x61, 0x63, 0x6b, 0x42, 0x69, 0x6f)
    [System.Array]::Copy($headerMagic, $templateBytes, 8)
    $dinBytes = [System.BitConverter]::GetBytes([uint32]27)
    [System.Array]::Copy($dinBytes, 0, $templateBytes, 8, 4)
    $word3Bytes = [byte[]]@(0x01, 0x00, 0x00, 0x00)
    [System.Array]::Copy($word3Bytes, 0, $templateBytes, 12, 4)
    [System.Array]::Copy($longBytes, 0, $templateBytes, 16, 1000)

    # Calculate sum index 12 to 1295
    $sum12 = 0
    for ($i = 12; $i -lt 1296; $i++) {
        if ($i -eq 15) { continue }
        $sum12 += $templateBytes[$i]
    }
    
    # Calculate sum index 16 to 1295
    $sum16 = 0
    for ($i = 16; $i -lt 1296; $i++) {
        $sum16 += $templateBytes[$i]
    }

    [void]$sb.AppendLine("Finger: $fingerId")
    [void]$sb.AppendLine("  Sum12-1295 (excl 15): $sum12 (Mod256: $($sum12 % 256))")
    [void]$sb.AppendLine("  Sum16-1295: $sum16 (Mod256: $($sum16 % 256))")
}

[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Done. Written to $outputFile"
