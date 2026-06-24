$ErrorActionPreference = "Stop"

$tempFile = "C:\RAMS\temp_templates.json"
$logFile = "C:\RAMS\sync_byte_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING SYNC BYTE PERMUTATIONS TEST ===")

# --- PROCESS 1: READ FROM OFFICE 1 ---
$readCmd = {
    $ErrorActionPreference = "Stop"
    Set-Location "C:\RAMS"
    [System.Reflection.Assembly]::LoadFrom("C:\RAMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("C:\RAMS\RealandAPI.dll") | Out-Null

    $device = New-Object RealandAPI.ZDC2911Finger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.61"
    $device.IpPort = 5500
    $device.DN = 2
    $device.Password = 0

    $device.OpenDevice() | Out-Null

    $queryList = New-Object 'System.Collections.Generic.List[RealandAPI.Enroll]'
    $e = New-Object RealandAPI.Enroll
    $e.DN = 2
    $e.DIN = [uint64]27
    $e.BackupNumber = 0 # First finger
    $queryList.Add($e)

    $device.GetEnrollO([ref]$queryList) | Out-Null
    $device.CloseDevice()

    if ($queryList[0].Fingerprint -ne $null) {
        $fpStr = $queryList[0].Fingerprint.ToString()
        $result = @{
            BackupNumber = $queryList[0].BackupNumber
            Fingerprint  = $fpStr
        }
        $result | ConvertTo-Json | Set-Content -Path "C:\RAMS\temp_templates.json"
        Write-Output "Template read successfully."
    } else {
        Write-Error "Template is null!"
    }
}

try {
    $readOutput = powershell -NoProfile -ExecutionPolicy Bypass -Command $readCmd
    [void]$sb.AppendLine("Read Output: $readOutput")
} catch {
    [void]$sb.AppendLine("Read Failed: $_")
    [System.IO.File]::WriteAllText($logFile, $sb.ToString())
    exit 1
}

# --- PROCESS 2: WRITE TO OFFICE 2 WITH BYTE PERMUTATIONS ---
$writeCmd = {
    $ErrorActionPreference = "Stop"
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

    $t = Get-Content -Path "C:\RAMS\temp_templates.json" -Raw | ConvertFrom-Json
    
    # Connect to Office 2 ZDFinger
    $device = New-Object RealandAPI.ZDFinger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.74"
    $device.IpPort = 5550
    $device.DN = 1
    $device.Password = 0

    $device.OpenDevice() | Out-Null

    # Parse Big-Endian (every 2 characters represents a byte in original order)
    $cleanHex = $t.Fingerprint -replace ' ', ''
    $bytesBE = [byte[]]((0..($cleanHex.Length/2 - 1)) | ForEach-Object { [System.Convert]::ToByte($cleanHex.Substring($_ * 2, 2), 16) })

    # Parse Little-Endian (every 8-char chunk is reversed)
    # e.g., "00172C04" -> bytes [04, 2C, 17, 00]
    $chunks = $t.Fingerprint -split ' '
    $bytesList = New-Object System.Collections.Generic.List[Byte]
    foreach ($chunk in $chunks) {
        $val = [System.Convert]::ToUInt32($chunk, 16)
        $chunkBytes = [System.BitConverter]::GetBytes($val)
        # Note: BitConverter.GetBytes on little-endian architecture returns bytes in little-endian order
        $bytesList.AddRange($chunkBytes)
    }
    $bytesLE = $bytesList.ToArray()

    # Test 1: SetEnroll with BE Bytes
    $enroll1 = New-Object RealandAPI.Enroll
    $enroll1.DN = 1
    $enroll1.DIN = [uint64]27
    $enroll1.BackupNumber = $t.BackupNumber
    $enroll1.Privilege = 0
    $enroll1.Fingerprint = $bytesBE
    $enroll1.Enable = $true
    $enroll1.UserName = "SALVIN RAMESH"
    $res1 = $device.SetEnroll($enroll1)
    Write-Output "Test 1 (SetEnroll with BE Bytes): $res1"

    # Test 2: SetEnrollO with BE Bytes
    $enroll2 = New-Object RealandAPI.Enroll
    $enroll2.DN = 1
    $enroll2.DIN = [uint64]27
    $enroll2.BackupNumber = $t.BackupNumber
    $enroll2.Privilege = 0
    $enroll2.Fingerprint = $bytesBE
    $enroll2.Enable = $true
    $enroll2.UserName = "SALVIN RAMESH"
    $res2 = $device.SetEnrollO($enroll2)
    Write-Output "Test 2 (SetEnrollO with BE Bytes): $res2"

    # Test 3: SetEnroll with LE Bytes
    $enroll3 = New-Object RealandAPI.Enroll
    $enroll3.DN = 1
    $enroll3.DIN = [uint64]27
    $enroll3.BackupNumber = $t.BackupNumber
    $enroll3.Privilege = 0
    $enroll3.Fingerprint = $bytesLE
    $enroll3.Enable = $true
    $enroll3.UserName = "SALVIN RAMESH"
    $res3 = $device.SetEnroll($enroll3)
    Write-Output "Test 3 (SetEnroll with LE Bytes): $res3"

    # Test 4: SetEnrollO with LE Bytes
    $enroll4 = New-Object RealandAPI.Enroll
    $enroll4.DN = 1
    $enroll4.DIN = [uint64]27
    $enroll4.BackupNumber = $t.BackupNumber
    $enroll4.Privilege = 0
    $enroll4.Fingerprint = $bytesLE
    $enroll4.Enable = $true
    $enroll4.UserName = "SALVIN RAMESH"
    $res4 = $device.SetEnrollO($enroll4)
    Write-Output "Test 4 (SetEnrollO with LE Bytes): $res4"

    $device.CloseDevice()
    Remove-Item -Path "C:\RAMS\temp_templates.json" -Force
}

try {
    $writeOutput = powershell -NoProfile -ExecutionPolicy Bypass -Command $writeCmd
    [void]$sb.AppendLine("Write Output:")
    foreach ($line in $writeOutput) {
        [void]$sb.AppendLine("  $line")
    }
} catch {
    [void]$sb.AppendLine("Write Failed: $_")
    if (Test-Path $tempFile) {
        Remove-Item -Path $tempFile -Force
    }
}

[void]$sb.AppendLine("=== TEST COMPLETE ===")
[System.IO.File]::WriteAllText($logFile, $sb.ToString())
Write-Output "Results written to $logFile"
