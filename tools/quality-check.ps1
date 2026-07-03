$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root "app.js"
$index = Join-Path $root "index.html"
$styles = Join-Path $root "styles.css"
$stylesDir = Join-Path $root "styles"
$theme = Join-Path $root "theme.css"
$components = Join-Path $root "components"
$core = Join-Path $root "core"

Write-Host "Memeriksa JavaScript..."
$jsFiles = @($app)
if (Test-Path $components) {
  $jsFiles += Get-ChildItem -LiteralPath $components -Filter "*.js" -File | Select-Object -ExpandProperty FullName
}
if (Test-Path $core) {
  $jsFiles += Get-ChildItem -LiteralPath $core -Filter "*.js" -File | Select-Object -ExpandProperty FullName
}
foreach ($file in $jsFiles) {
  node --check $file
}

Write-Host "Memeriksa pola render berisiko..."
$appText = Get-Content -Raw -LiteralPath $app
if ($appText -match "\balert\s*\(") {
  throw "Masih ada alert(). Gunakan notify() agar UX konsisten."
}
if ($appText -match "\.on(click|change|input|submit)\s*=" -or $appText -match "\son(click|change|input|submit)\s*=") {
  throw "Ditemukan event handler inline/property assignment. Gunakan addEventListener/data-action."
}

Write-Host "Memeriksa tombol dan scroll..."
$markupFiles = @($app, $index)
if (Test-Path $components) {
  $markupFiles += Get-ChildItem -LiteralPath $components -Filter "*.js" -File | Select-Object -ExpandProperty FullName
}
if (Test-Path $core) {
  $markupFiles += Get-ChildItem -LiteralPath $core -Filter "*.js" -File | Select-Object -ExpandProperty FullName
}
foreach ($file in $markupFiles) {
  $text = Get-Content -Raw -LiteralPath $file
  if ($text -match "scrollIntoView\s*\(") {
    throw ("Masih ada scrollIntoView() di {0}. Gunakan core/scroll.js." -f (Split-Path -Leaf $file))
  }
  $missingType = [regex]::Matches($text, "<button\b(?![^>]*\btype=)[^>]*>", "IgnoreCase")
  if ($missingType.Count -gt 0) {
    throw ("Masih ada <button> tanpa type di {0}." -f (Split-Path -Leaf $file))
  }
}

Write-Host "Ringkasan ukuran file:"
$fileBudgets = @(
  @{ Path = $app; Warn = 6500; Max = 9000 },
  @{ Path = $index; Warn = 1500; Max = 3000 },
  @{ Path = $styles; Warn = 5000; Max = 7000 },
  @{ Path = $theme; Warn = 1000; Max = 2500 }
)
if (Test-Path $stylesDir) {
  $fileBudgets += Get-ChildItem -LiteralPath $stylesDir -Filter "*.css" -File | ForEach-Object {
    @{ Path = $_.FullName; Warn = 1200; Max = 2500 }
  }
}
foreach ($item in $fileBudgets) {
  $file = $item.Path
  if (!(Test-Path $file)) { continue }
  $lineCount = (Get-Content -LiteralPath $file | Measure-Object -Line).Lines
  $name = Split-Path -Leaf $file
  $status = if ($lineCount -gt $item.Warn) { "PERLU DIPANTAU" } else { "OK" }
  Write-Host ("- {0}: {1} baris ({2})" -f $name, $lineCount, $status)
  if ($lineCount -gt $item.Max) {
    throw ("{0} melewati batas maksimum {1} baris. Pecah modul sebelum deploy." -f $name, $item.Max)
  }
}

Write-Host "Quality check selesai."
