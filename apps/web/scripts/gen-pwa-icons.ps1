Add-Type -AssemblyName System.Drawing
# Same mark as in-app `LogBaseMark` (dark theme asset). Transparent PNG — no matte fill so OS shells show true alpha.
$srcPath = Join-Path $PSScriptRoot "..\public\Logos\logbase-dark.png" | Resolve-Path
$iconsDir = Join-Path $PSScriptRoot "..\public\icons"
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
$outDir = Resolve-Path $iconsDir
$src = [System.Drawing.Image]::FromFile($srcPath)

function Export-SquareIcon {
  param(
    [int]$Size,
    [string]$OutPath,
    # Logo fill vs canvas. 0.93 = home screen; ~0.55 = Android maskable safe zone.
    [double]$LogoScale = 0.93,
    # $null = transparent (Windows tiles). Black fill for Android / iOS install icons.
    [System.Drawing.Color]$BackgroundColor = [System.Drawing.Color]::Transparent
  )
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  if ($BackgroundColor -eq [System.Drawing.Color]::Transparent) {
    $g.Clear([System.Drawing.Color]::Transparent)
  } else {
    $g.Clear($BackgroundColor)
  }
  $scale = [Math]::Min($Size / $src.Width, $Size / $src.Height) * $LogoScale
  $w = [int][Math]::Round($src.Width * $scale)
  $h = [int][Math]::Round($src.Height * $scale)
  $x = ($Size - $w) / 2
  $y = ($Size - $h) / 2
  $g.DrawImage($src, $x, $y, $w, $h)
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$black = [System.Drawing.Color]::FromArgb(255, 0, 0, 0)

# Android / Chromium install + notifications (black tile + dark-theme mark)
Export-SquareIcon -Size 192 -BackgroundColor $black -OutPath (Join-Path $outDir "logbase-app-192.png")
Export-SquareIcon -Size 512 -BackgroundColor $black -OutPath (Join-Path $outDir "logbase-app-512.png")
Export-SquareIcon -Size 512 -LogoScale 0.55 -BackgroundColor $black -OutPath (Join-Path $outDir "logbase-app-maskable-512.png")

# iOS Add to Home Screen (apple-touch-icon sizes)
Export-SquareIcon -Size 180 -BackgroundColor $black -OutPath (Join-Path $outDir "logbase-app-180.png")
Export-SquareIcon -Size 152 -BackgroundColor $black -OutPath (Join-Path $outDir "logbase-app-152.png")
Export-SquareIcon -Size 167 -BackgroundColor $black -OutPath (Join-Path $outDir "logbase-app-167.png")

# Windows / general (transparent — taskbar tile + msapplication)
Export-SquareIcon -Size 256 -OutPath (Join-Path $outDir "logbase-app-256.png")
Export-SquareIcon -Size 512 -OutPath (Join-Path $outDir "logbase-app-512-win.png")

$appDir = Join-Path $PSScriptRoot "..\src\app" | Resolve-Path
Copy-Item -Force (Join-Path $outDir "logbase-app-180.png") (Join-Path $appDir "apple-icon.png")
Copy-Item -Force (Join-Path $outDir "logbase-app-256.png") (Join-Path $appDir "icon.png")

$src.Dispose()
Write-Host "Wrote public/icons/logbase-app-*.png and synced src/app/apple-icon.png (180), icon.png (256)"
