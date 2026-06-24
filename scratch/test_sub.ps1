$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\test_sub_results.txt"
$sb = New-Object System.Text.StringBuilder

$cmd = {
    $subCmd = {
        Write-Output "HELLO FROM SUBPROCESS"
    }
    $cmdText = $subCmd.ToString()
    $res = powershell -NoProfile -ExecutionPolicy Bypass -Command $cmdText
    Write-Output "Result: $res"
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
