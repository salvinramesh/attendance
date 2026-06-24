$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\make_long_800_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING MAKE LONG 800 TEST ===")

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
    Write-Output "Padded bytes length: $($paddedBytes.Length)"

    # Convert directly to long fingerprint string
    $longFpStr = $device.MakeLongeFingerprint($paddedBytes)
    Write-Output "MakeLongeFingerprint string length: $($longFpStr.Length)"

    if ($longFpStr.Length -gt 0) {
        Write-Output "Snippet: $($longFpStr.Substring(0, 150))"
        
        $device.OpenDevice() | Out-Null

        # Try to SetEnroll
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

        Write-Output "Writing updated enroll to device..."
        $setRes = $device.SetEnroll($enroll)
        Write-Output "SetEnroll result: $setRes"

        $nameRes = $device.SetUserName($enroll)
        Write-Output "SetUserName result: $nameRes"

        $device.CloseDevice()
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
