$ErrorActionPreference = "Stop"

$tempFile = "C:\RAMS\temp_templates.json"
$logFile = "C:\RAMS\conversion_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING CONVERSION TEST ===")

# --- PROCESS 1: READ SHORT TEMPLATE FROM OFFICE 1 ---
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
    $e.BackupNumber = 0
    $queryList.Add($e)
    $device.GetEnrollO([ref]$queryList) | Out-Null
    $device.CloseDevice()

    if ($queryList[0].Fingerprint -ne $null) {
        $fpStr = $queryList[0].Fingerprint.ToString()
        $result = @{
            Fingerprint = $fpStr
        }
        $result | ConvertTo-Json | Set-Content -Path "C:\RAMS\temp_templates.json"
        Write-Output "Short template read successfully. Length: $($fpStr.Length)"
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

# --- PROCESS 2: TEST CONVERSIONS IN RIMS ---
$writeCmd = {
    $ErrorActionPreference = "Stop"
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

    $t = Get-Content -Path "C:\RAMS\temp_templates.json" -Raw | ConvertFrom-Json
    
    # Connect/init ZDFinger
    $device = New-Object RealandAPI.ZDFinger
    $device.Communication = 1
    $device.IpAddress = "192.168.5.74"
    $device.IpPort = 5550
    $device.DN = 1
    $device.Password = 0

    # Convert the short template string back to a byte array
    $chunks = $t.Fingerprint -split ' '
    $bytesList = New-Object System.Collections.Generic.List[Byte]
    foreach ($chunk in $chunks) {
        $val = [System.Convert]::ToUInt32($chunk, 16)
        $chunkBytes = [System.BitConverter]::GetBytes($val)
        $bytesList.AddRange($chunkBytes)
    }
    $shortBytes = $bytesList.ToArray()
    Write-Output "Parsed short template bytes. Length: $($shortBytes.Length)"

    # Test 1: ConvertToLongMessage
    try {
        $longBytes = $device.ConvertToLongMessage($shortBytes)
        if ($longBytes -ne $null) {
            Write-Output "ConvertToLongMessage returned byte array of length: $($longBytes.Length)"
            # Convert to space-separated hex words
            $words = @()
            for ($i = 0; $i -lt $longBytes.Length; $i += 4) {
                $val = [System.BitConverter]::ToUInt32($longBytes, $i)
                $words += "{0:X8}" -f $val
            }
            $longFpStr = $words -join " "
            Write-Output "Generated Long String via ConvertToLongMessage. Length: $($longFpStr.Length)"
            Write-Output "Snippet: $($longFpStr.Substring(0, 100))"
        } else {
            Write-Output "ConvertToLongMessage returned null!"
        }
    } catch {
        Write-Output "ConvertToLongMessage threw exception: $_"
    }

    # Test 2: MakeLongeFingerprint
    try {
        $longFpStr = $device.MakeLongeFingerprint($shortBytes)
        Write-Output "MakeLongeFingerprint returned string of length: $($longFpStr.Length)"
        if ($longFpStr.Length -gt 0) {
            Write-Output "Snippet: $($longFpStr.Substring(0, 100))"
        }
    } catch {
        Write-Output "MakeLongeFingerprint threw exception: $_"
    }

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
