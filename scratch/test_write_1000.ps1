$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\write_1000_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING WRITE 1000 TEST ===")

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

    # Format 1000 bytes as space-separated hex words
    $words = @()
    for ($i = 0; $i -lt $longBytes.Length; $i += 4) {
        $val = [System.BitConverter]::ToUInt32($longBytes, $i)
        $words += "{0:X8}" -f $val
    }
    $longFpStr = $words -join " "
    Write-Output "Formatted 1000-byte string length: $($longFpStr.Length)"

    # SetEnroll to device
    $enroll = New-Object RealandAPI.Enroll
    $enroll.DN = 1
    $enroll.DIN = [uint64]27
    $enroll.BackupNumber = 0
    $enroll.Privilege = 0
    $enroll.Fingerprint = $longFpStr
    $enroll.Enable = $true
    $enroll.UserName = "SALVIN RAMESH"
    
    # RIMS specific properties
    $enroll.ValidDate = [DateTime]"2026-01-01 00:00:00"
    $enroll.InvalidDate = [DateTime]"2099-12-31 23:59:59"
    $enroll.Password = [uint32]0
    $enroll.TimeAccessZone = 0
    $enroll.UnlockGroup = 0
    $enroll.UserExtInfo = ""

    $setRes = $device.SetEnroll($enroll)
    Write-Output "SetEnroll result: $setRes"

    # Try setting name
    $nameRes = $device.SetUserName($enroll)
    Write-Output "SetUserName result: $nameRes"

    # Read back to verify
    if ($setRes) {
        $e2 = New-Object RealandAPI.Enroll
        $e2.DN = 1
        $e2.DIN = [uint64]27
        $e2.BackupNumber = 0
        $getRes = $device.GetEnroll($e2)
        Write-Output "GetEnroll result: $getRes"
        if ($getRes -and $e2.Fingerprint -ne $null) {
            $retStr = $e2.Fingerprint.ToString()
            Write-Output "Retrieved fingerprint string length: $($retStr.Length)"
            Write-Output "Retrieved snippet: $($retStr.Substring(0, 150))"
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
