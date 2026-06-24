$outputFile = "C:\RAMS\inspect_results.txt"
$sb = New-Object System.Text.StringBuilder

# Run isolated PowerShell command for RIMS inspection
$rimsCmd = {
    $dllPath = "D:\RIMS\RealandAPI.dll"
    $rissDllPath = "D:\RIMS\Riss.Devices.dll"
    [System.Reflection.Assembly]::LoadFile($rissDllPath) | Out-Null
    $assembly = [System.Reflection.Assembly]::LoadFile($dllPath)
    
    $types = $assembly.GetTypes()
    Write-Output "=== RIMS DLL Types: $dllPath ==="
    Write-Output "Total types: $($types.Count)"
    foreach ($t in $types) {
        Write-Output "  - $($t.FullName)"
    }
    
    # Dump ZDFinger details if found
    $zdfinger = $types | Where-Object { $_.Name -eq "ZDFinger" }
    if ($zdfinger) {
        Write-Output "--- Methods for Class: ZDFinger ---"
        $zdfinger.GetMethods() | ForEach-Object {
            $params = ($_.GetParameters() | ForEach-Object { "$($_.ParameterType.Name) $($_.Name)" }) -join ", "
            Write-Output "$($_.ReturnType.Name) $($_.Name)($params)"
        }
        
        Write-Output "--- Properties for Class: ZDFinger ---"
        $zdfinger.GetProperties() | ForEach-Object {
            Write-Output "$($_.PropertyType.Name) $($_.Name)"
        }
    } else {
        # Check through other loaded assemblies for ZDFinger
        $allTypes = [AppDomain]::CurrentDomain.GetAssemblies() | ForEach-Object { $_.GetTypes() }
        $zdfingerAny = $allTypes | Where-Object { $_.Name -eq "ZDFinger" }
        if ($zdfingerAny) {
            Write-Output "Found ZDFinger in assembly: $($zdfingerAny.Assembly.FullName)"
            Write-Output "--- Methods for Class: ZDFinger ---"
            $zdfingerAny.GetMethods() | ForEach-Object {
                $params = ($_.GetParameters() | ForEach-Object { "$($_.ParameterType.Name) $($_.Name)" }) -join ", "
                Write-Output "$($_.ReturnType.Name) $($_.Name)($params)"
            }
        } else {
            Write-Output "ZDFinger not found in any loaded assembly!"
        }
    }
    
    # Dump Enroll details
    $enrollType = $types | Where-Object { $_.Name -eq "Enroll" }
    if ($enrollType) {
        Write-Output "--- Properties for Class: Enroll ---"
        $enrollType.GetProperties() | ForEach-Object {
            Write-Output "$($_.PropertyType.FullName) $($_.Name)"
        }
        Write-Output "--- Fields for Class: Enroll ---"
        $enrollType.GetFields() | ForEach-Object {
            Write-Output "$($_.FieldType.FullName) $($_.Name)"
        }
    }
}

# Run the script block in a fresh powershell process and capture output
$output = powershell -NoProfile -Command $rimsCmd
Set-Content -Path $outputFile -Value $output
Write-Output "Results written to $outputFile"
