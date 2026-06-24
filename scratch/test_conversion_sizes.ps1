$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\conversion_sizes_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING CONVERSION SIZES TEST ===")

$cmd = {
    $ErrorActionPreference = "Stop"
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

    # Connect/init ZDFinger
    $device = New-Object RealandAPI.ZDFinger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.74"
    $device.IpPort = 5550
    $device.DN = 1
    $device.Password = 0

    # Get short template from RAMS DB for DIN 27
    $conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\RAMS\Database\RAS.mdb;Jet OLEDB:Database Password=ras258;")
    $conn.Open()
    $dbCmd = $conn.CreateCommand()
    $dbCmd.CommandText = "SELECT Fingerprint FROM ras_Enroll WHERE DIN = 27 AND BackupNumber = 0"
    $fpStr = $dbCmd.ExecuteScalar().ToString()
    $conn.Close()

    # Parse short template string to byte array
    $chunks = $fpStr -split ' '
    $bytesList = New-Object System.Collections.Generic.List[Byte]
    foreach ($chunk in $chunks) {
        $val = [System.Convert]::ToUInt32($chunk, 16)
        $chunkBytes = [System.BitConverter]::GetBytes($val)
        $bytesList.AddRange($chunkBytes)
    }
    $shortBytes = $bytesList.ToArray()
    Write-Output "Original short bytes length: $($shortBytes.Length)"

    # Test various padded sizes
    $sizes = @(500, 504, 512, 600, 700, 800, 900, 1000, 1412, 1416)
    foreach ($size in $sizes) {
        # Create padded array
        $paddedBytes = New-Object Byte[] $size
        $copyLen = [System.Math]::Min($shortBytes.Length, $size)
        [System.Array]::Copy($shortBytes, $paddedBytes, $copyLen)
        
        try {
            $longBytes = $device.ConvertToLongMessage($paddedBytes)
            if ($longBytes -ne $null) {
                Write-Output "Size $size Success! Returned byte array of length: $($longBytes.Length)"
            } else {
                Write-Output "Size $size returned null!"
            }
        } catch {
            Write-Output "Size $size Failed: $($_.Exception.Message)"
        }
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
