$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\db_columns_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== STARTING DB COLUMNS QUERY ===")

$cmd = {
    $ErrorActionPreference = "Stop"
    $conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=D:\RIMS\Database\RAS.mdb;Jet OLEDB:Database Password=ras258;")
    $conn.Open()
    
    $dins = @(1, 2, 4, 6, 7, 12, 86)
    foreach ($din in $dins) {
        $dbCmd = $conn.CreateCommand()
        $dbCmd.CommandText = "SELECT DIN, BackupNumber, Privilege, Enable, AccessTimeZone, UnlockGroup FROM ras_Enroll WHERE DIN = $din AND BackupNumber = 0"
        $reader = $dbCmd.ExecuteReader()
        if ($reader.Read()) {
            $bn = $reader["BackupNumber"].ToString()
            $priv = $reader["Privilege"].ToString()
            $en = $reader["Enable"].ToString()
            $atz = $reader["AccessTimeZone"].ToString()
            $ug = $reader["UnlockGroup"].ToString()
            Write-Output "DIN: $din | BackupNumber: $bn | Privilege: $priv | Enable: $en | AccessTimeZone: $atz | UnlockGroup: $ug"
        }
        $reader.Close()
    }
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
