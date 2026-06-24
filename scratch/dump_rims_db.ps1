$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\rims_db_dump.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING RIMS DB DUMP ===")

$cmd = {
    $ErrorActionPreference = "Stop"
    $conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=D:\RIMS\Database\RAS.mdb;Jet OLEDB:Database Password=ras258;")
    $conn.Open()
    $dbCmd = $conn.CreateCommand()
    $dbCmd.CommandText = "SELECT TOP 5 DIN, BackupNumber, Fingerprint FROM ras_Enroll WHERE BackupNumber <= 9"
    $reader = $dbCmd.ExecuteReader()
    while ($reader.Read()) {
        $din = $reader["DIN"].ToString()
        $bn = $reader["BackupNumber"].ToString()
        $fp = $reader["Fingerprint"].ToString()
        Write-Output "DIN: $din | BackupNumber: $bn | Length: $($fp.Length) | Snippet: $($fp.Substring(0, [System.Math]::Min(150, $fp.Length)))"
    }
    $reader.Close()
    $conn.Close()
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
