Add-Type -AssemblyName System.Drawing
$size=256
$bitmap=New-Object System.Drawing.Bitmap ($size),($size),([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics=[System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::Transparent)
$rect=New-Object System.Drawing.RectangleF (12),(12),(232),(232)
$path=New-Object System.Drawing.Drawing2D.GraphicsPath
$r=48
$path.AddArc($rect.Left,$rect.Top,$r,$r,180,90)
$path.AddArc(($rect.Right-$r),$rect.Top,$r,$r,270,90)
$path.AddArc(($rect.Right-$r),($rect.Bottom-$r),$r,$r,0,90)
$path.AddArc($rect.Left,($rect.Bottom-$r),$r,$r,90,90)
$path.CloseFigure()
$grad=New-Object System.Drawing.Drawing2D.LinearGradientBrush ($rect),([System.Drawing.Color]::FromArgb(142,240,186)),([System.Drawing.Color]::FromArgb(103,192,221)),(45.0)
$graphics.FillPath($grad,$path)
$font=New-Object System.Drawing.Font ('Arial'),(160),([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
$brush=New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(8,30,28))
$graphics.DrawString('C',$font,$brush,[float]62,[float]34)
$gold=New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(229,199,135))
$graphics.FillEllipse($gold,193,202,38,38)
$png=New-Object System.IO.MemoryStream
$bitmap.Save($png,[System.Drawing.Imaging.ImageFormat]::Png)
$buf=$png.ToArray()
$ico='D:\Velvet\Installers\CraftSuite\Center\NativeWindows\icon.ico'
$stream=[System.IO.File]::Create($ico)
$writer=New-Object System.IO.BinaryWriter($stream)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]1)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([uint16]1)
$writer.Write([uint16]32)
$writer.Write([uint32]$buf.Length)
$writer.Write([uint32]22)
$writer.Write($buf)
$writer.Close()
$graphics.Dispose()
$bitmap.Dispose()
'ICON_READY='+$ico
'ICON_BYTES='+(Get-Item $ico).Length
