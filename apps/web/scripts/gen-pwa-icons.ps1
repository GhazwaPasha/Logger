Add-Type -AssemblyName System.Drawing
# Same mark as in-app `LogBaseMark` (dark theme asset). Transparent PNG — no matte fill so OS shells show true alpha.
$srcPath = Join-Path $PSScriptRoot "..\public\Logos\logbase-dark.png" | Resolve-Path
$outDir = Join-Path $PSScriptRoot "..\public" | Resolve-Path
$src = [System.Drawing.Image]::FromFile($srcPath)

function Export-SquareIcon {
  param([int]$Size, [string]$OutPath)
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  # Fill ~93% of the square so the mark reads at Windows tile/taskbar sizes (was 0.72 — looked tiny).
  $scale = [Math]::Min($Size / $src.Width, $Size / $src.Height) * 0.93
  $w = [int][Math]::Round($src.Width * $scale)
  $h = [int][Math]::Round($src.Height * $scale)
  $x = ($Size - $w) / 2
  $y = ($Size - $h) / 2
  $g.DrawImage($src, $x, $y, $w, $h)
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

Export-SquareIcon -Size 192 -OutPath (Join-Path $outDir "pwa-192.png")
Export-SquareIcon -Size 256 -OutPath (Join-Path $outDir "pwa-256.png")
Export-SquareIcon -Size 512 -OutPath (Join-Path $outDir "pwa-512.png")
$src.Dispose()
Write-Host "Wrote pwa-192.png, pwa-256.png, and pwa-512.png"
