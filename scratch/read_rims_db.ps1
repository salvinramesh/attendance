$ErrorActionPreference = "Stop"

$logFile = "C:\RAMS\rims_db_results.txt"
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("=== READING RIMS ACCESS DB ===")

$cmd = {
    $ErrorActionPreference = "Stop"
    
    # Provider for Access MDB
    $connStr = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=D:\RIMS\Database\RAS.mdb;Jet OLEDB:Database Password=ras258;"
    $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
    $conn.Open()

    $dbCmd = $conn.CreateCommand()
    $dbCmd.CommandText = "SELECT DIN, BackupNumber, Fingerprint FROM ras_Enroll WHERE DIN IN (12, 86)"
    $reader = $dbCmd.ExecuteReader()

    while ($reader.Read()) {
        $din = $reader["DIN"]
        $bn = $reader["BackupNumber"]
        $fp = $reader["Fingerprint"]
        
        if ($fp -ne [System.DBNull]::Value) {
            $fpStr = $fp.ToString()
            Write-Output "DIN: $din | Backup: $bn | Length: $($fpStr.Length)"
            Write-Output "Template: $fpStr"
        } else {
            Write-Output "DIN: $din | Backup: $bn | Fingerprint is Null"
        }
    }
    $reader.Close()
    $conn.Close()
}

try {
    # Run using 32-bit PowerShell to support Jet provider
    $output = C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -Command $cmd
    [void]$sb.AppendLine("Output:")
    foreach ($line in $output) {
        [void]$sb.AppendLine("  $line")
    }
} catch {
    [void]$sb.AppendLine("Failed: $_")
}

[System.IO.File]::WriteAllText($logFile, $sb.ToString())
Write-Output "Results written to $logFile"
