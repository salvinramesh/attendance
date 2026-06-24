$dllPath = "C:\RAMS\RealandAPI.dll"
$rissDllPath = "C:\RAMS\Riss.Devices.dll"

# Load in correct order
[System.Reflection.Assembly]::LoadFrom($rissDllPath) | Out-Null
[System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null

$outputFile = "C:\RAMS\rams_inspect_results.txt"
$sb = New-Object System.Text.StringBuilder

$assembly = [System.Reflection.Assembly]::LoadFrom($dllPath)
$types = $assembly.GetTypes()

[void]$sb.AppendLine("=== RAMS DLL Types ===")
[void]$sb.AppendLine("Total types: $($types.Count)")

$zdc2911 = $types | Where-Object { $_.Name -eq "ZDC2911Finger" }
if ($zdc2911) {
    [void]$sb.AppendLine("--- Methods for Class: ZDC2911Finger ---")
    $zdc2911.GetMethods() | ForEach-Object {
        $params = ($_.GetParameters() | ForEach-Object { "$($_.ParameterType.Name) $($_.Name)" }) -join ", "
        [void]$sb.AppendLine("$($_.ReturnType.Name) $($_.Name)($params)")
    }
    
    [void]$sb.AppendLine("--- Properties for Class: ZDC2911Finger ---")
    $zdc2911.GetProperties() | ForEach-Object {
        [void]$sb.AppendLine("$($_.PropertyType.Name) $($_.Name)")
    }
} else {
    [void]$sb.AppendLine("ZDC2911Finger class not found in RAMS DLL!")
}

[System.IO.File]::WriteAllText($outputFile, $sb.ToString())
Write-Output "Results written to $outputFile"
