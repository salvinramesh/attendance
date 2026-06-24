$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\make_long_opened_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING MAKE LONG OPENED TEST ===")

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
    Write-Output "Device connected successfully."

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

    # Test 1: shortBytes (500 bytes)
    try {
        $longFpStr1 = $device.MakeLongeFingerprint($shortBytes)
        Write-Output "Test 1 (500 bytes) MakeLongeFingerprint string length: $($longFpStr1.Length)"
    } catch {
        Write-Output "Test 1 Failed: $($_.Exception.Message)"
    }

    # Test 2: paddedBytes (800 bytes)
    $paddedBytes = New-Object Byte[] 800
    [System.Array]::Copy($shortBytes, $paddedBytes, $shortBytes.Length)
    try {
        $longFpStr2 = $device.MakeLongeFingerprint($paddedBytes)
        Write-Output "Test 2 (800 bytes) MakeLongeFingerprint string length: $($longFpStr2.Length)"
    } catch {
        Write-Output "Test 2 Failed: $($_.Exception.Message)"
    }

    # Test 3: ConvertToLongMessage + MakeLongeFingerprint
    try {
        $longBytes = $device.ConvertToLongMessage($paddedBytes)
        Write-Output "ConvertToLongMessage returned byte array of length: $($longBytes.Length)"
        $longFpStr3 = $device.MakeLongeFingerprint($longBytes)
        Write-Output "Test 3 (1000 bytes from ConvertToLong) MakeLongeFingerprint string length: $($longFpStr3.Length)"
    } catch {
        Write-Output "Test 3 Failed: $($_.Exception.Message)"
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

[void]$sb.AppendLine("=== TEST COMPLETE ===")
[System.IO.File]::WriteAllText($logFile, $sb.ToString())
Write-Output "Results written to $logFile"
