# Urcă cheile din .env.production.local în Vercel (mediul Production).
# Valorile nu se afișează pe ecran. Rulare din folderul proiectului:
#   powershell -ExecutionPolicy Bypass -File scripts\push-env.ps1            (doar verifică)
#   powershell -ExecutionPolicy Bypass -File scripts\push-env.ps1 -Upload    (verifică și urcă)
param([switch]$Upload)

$ErrorActionPreference = 'Stop'
$node = 'C:\Users\Contabil\AppData\Local\Programs\nodejs'
if (Test-Path $node) { $env:Path = "$node;" + $env:Path }

$file = Join-Path (Get-Location) '.env.production.local'
if (-not (Test-Path $file)) { Write-Output "Lipseste fisierul $file"; exit 1 }

$required = 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID',
            'ADMIN_PASSWORD', 'AUTH_SECRET', 'CRM_WEBHOOK_URL', 'CRM_WEBHOOK_SECRET'
$vars = [ordered]@{}
foreach ($line in [System.IO.File]::ReadAllLines($file)) {
  if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$') {
    $vars[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}

# Verificări de format (fără a afișa valorile)
$checks = @{
  SUPABASE_URL        = '^https://[a-z0-9-]+\.supabase\.co/?$'
  SUPABASE_SECRET_KEY = '^\S{20,}$'
  TELEGRAM_BOT_TOKEN  = '^\d{6,}:[A-Za-z0-9_-]{30,}$'
  TELEGRAM_CHAT_ID    = '^-?\d{5,}$'
  ADMIN_PASSWORD      = '^.{8,}$'
  AUTH_SECRET         = '^.{32,}$'
  CRM_WEBHOOK_URL     = '^https://\S+$'
  CRM_WEBHOOK_SECRET  = '^.{8,}$'
}
$ok = $true
foreach ($k in $required) {
  $v = $vars[$k]
  if (-not $v) { Write-Output "LIPSA     $k"; $ok = $false }
  elseif ($v -notmatch $checks[$k]) { Write-Output "FORMAT?   $k (lungime $($v.Length))"; $ok = $false }
  else { Write-Output "OK        $k" }
}
if (-not $ok) { Write-Output "`nCompleteaza/corecteaza valorile de mai sus si incearca din nou."; exit 2 }
if (-not $Upload) { Write-Output "`nToate cheile arata corect."; exit 0 }

foreach ($k in $required) {
  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($tmp, $vars[$k], (New-Object System.Text.UTF8Encoding $false))
    cmd /c "vercel env rm $k production --yes >nul 2>&1"
    cmd /c "vercel env add $k production < `"$tmp`" >nul 2>&1"
    if ($LASTEXITCODE -eq 0) { Write-Output "URCAT     $k" } else { Write-Output "EROARE    $k"; $ok = $false }
  } finally { Remove-Item $tmp -Force }
}
if (-not $ok) { exit 3 }
