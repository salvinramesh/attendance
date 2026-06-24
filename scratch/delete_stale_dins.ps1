$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\delete_stale_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING STALE DIN DELETION ===")

$cmd = {
    $ErrorActionPreference = "Continue"
    Set-Location "D:\RIMS"
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\Riss.Devices.dll") | Out-Null
    [System.Reflection.Assembly]::LoadFrom("D:\RIMS\RealandAPI.dll") | Out-Null

    # Read active DINs from JSON
    $jsonPath = "C:\RAMS\active_device2_dins.json"
    $activeDins = Get-Content -Path $jsonPath -Raw | ConvertFrom-Json
    $activeDinsSet = New-Object System.Collections.Generic.HashSet[int]
    foreach ($id in $activeDins) {
        [void]$activeDinsSet.Add($id)
    }

    # Connect to scanner
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

    # Fetch all enrolls
    $enrolls = $device.GetAllEnroll()
    Write-Output "Initial scanner enrollments: $($enrolls.Count)"

    $deletedCount = 0
    $failedCount = 0
    $seenDins = New-Object System.Collections.Generic.HashSet[int]

    foreach ($e in $enrolls) {
        $din = [int]$e.DIN
        if ($din -eq 0) { continue }
        
        if (-not $activeDinsSet.Contains($din)) {
            if (-not $seenDins.Contains($din)) {
                [void]$seenDins.Add($din)
                
                # Try deleting using the actual enroll object from GetAllEnroll
                # Set backup number to a special value to delete all
                try {
                    $e.BackupNumber = 0
                    $res = $device.DelEnroll($e, $false)
                    if ($res) {
                        $deletedCount++
                    } else {
                        $failedCount++
                        Write-Output "  DelEnroll returned False for DIN $din"
                    }
                } catch {
                    $failedCount++
                    Write-Output "  Error deleting DIN $($din): $_"
                }
            }
        }
    }

    $device.CloseDevice()
    Write-Output "Deleted: $deletedCount | Failed: $failedCount | Total stale: $($seenDins.Count)"
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
