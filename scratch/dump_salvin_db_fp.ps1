$ErrorActionPreference = "Stop"

$outputFile = "C:\RAMS\salvin_db_fp.txt"
$sb = New-Object System.Text.StringBuilder

$conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\RAMS\Database\RAS.mdb;Jet OLEDB:Database Password=ras258;")
$conn.Open()
$dbCmd = $conn.CreateCommand()
$dbCmd.CommandText = "SELECT BackupNumber, Fingerprint FROM ras_Enroll WHERE DIN = 27 AND BackupNumber <= 9"
$reader = $dbCmd.ExecuteReader()
while ($reader.Read()) {
    $bn = [int]$reader["BackupNumber"]
    $fp = $reader["Fingerprint"].ToString()
    [void]$sb.AppendLine("BackupNumber: $bn")
    [void]$sb.AppendLine("Fingerprint snippet: $(if ($fp.Length -gt 60) { $fp.Substring(0, 60) + '...' } else { $fp })")
    [void]$sb.AppendLine("Fingerprint total length: $($fp.Length)")
}
$reader.Close()
$conn.Close()

[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Written to $outputFile"
