# PowerShell script to inspect C:\RIMS\database\RAS.mdb via ODBC

$dbPath = "C:\RIMS\database\RAS.mdb"
if (-not (Test-Path $dbPath)) {
    Write-Error "Database file not found at $dbPath"
    Exit
}

Write-Host "Database file found at: $dbPath"

# Try different connection strings
$connStrings = @(
    "Driver={Microsoft Access Driver (*.mdb)};Dbq=$dbPath;",
    "Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq=$dbPath;"
)

$conn = $null
$workingConnString = $null

foreach ($connStr in $connStrings) {
    try {
        Write-Host "Trying connection string: $connStr"
        $conn = New-Object System.Data.Odbc.OdbcConnection($connStr)
        $conn.Open()
        Write-Host "Connection successful!" -ForegroundColor Green
        $workingConnString = $connStr
        break
    } catch {
        Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($conn -ne $null) {
            $conn.Close()
        }
    }
}

if (-not $workingConnString) {
    Write-Error "Could not connect to the database with any of the Access ODBC drivers."
    Exit
}

try {
    # 1. Get Tables List
    Write-Host "`n--- List of Tables ---" -ForegroundColor Cyan
    $schema = $conn.GetSchema("Tables")
    
    # Filter for user tables (usually TABLE_TYPE = "TABLE" or just everything not system)
    $tables = $schema | Where-Object { $_.TABLE_TYPE -eq 'TABLE' } | Select-Object TABLE_NAME
    $tables | Format-Table -AutoSize

    # 2. Inspect Schema for interesting tables
    # Common RAMS/Realand tables are t_checkinout, checkinout, UserLg, userinfo, t_user
    $interestingTables = @("t_checkinout", "checkinout", "UserLg", "userinfo", "t_user", "UserLog")
    $foundTables = @()
    
    foreach ($table in $tables) {
        $name = $table.TABLE_NAME
        foreach ($interest in $interestingTables) {
            if ($name -like "*$interest*") {
                $foundTables += $name
            }
        }
    }
    
    $foundTables = $foundTables | Select-Object -Unique
    Write-Host "Found matching interesting tables: $($foundTables -join ', ')" -ForegroundColor Yellow

    # If no tables found, list all tables
    if ($foundTables.Count -eq 0) {
        $foundTables = $tables.TABLE_NAME
    }

    foreach ($tableName in $foundTables) {
        Write-Host "`n--- Sample and Schema for table: $tableName ---" -ForegroundColor Cyan
        
        # Get Columns/Schema
        try {
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = "SELECT TOP 1 * FROM [$tableName]"
            $reader = $cmd.ExecuteReader()
            
            Write-Host "Columns:" -ForegroundColor Yellow
            for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                Write-Host "  - $($reader.GetName($i)) ($($reader.GetFieldType($i)))"
            }
            $reader.Close()
        } catch {
            Write-Host "Failed to get schema for $tableName: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Fetch sample data (top 5 rows)
        try {
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = "SELECT TOP 5 * FROM [$tableName]"
            $adapter = New-Object System.Data.Odbc.OdbcDataAdapter($cmd)
            $dt = New-Object System.Data.DataTable
            $adapter.Fill($dt) | Out-Null
            
            Write-Host "Sample Data (Top 5):" -ForegroundColor Yellow
            $dt | Format-Table -AutoSize
        } catch {
            Write-Host "Failed to get sample data for $tableName: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

} catch {
    Write-Error "An error occurred during database inspection: $($_.Exception.Message)"
} finally {
    if ($conn -ne $null) {
        $conn.Close()
        Write-Host "`nDatabase connection closed."
    }
    Write-Host "`nPress Enter to exit..."
    Read-Host
}
