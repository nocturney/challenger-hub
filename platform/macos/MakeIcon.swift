import AppKit
import Foundation

let filename = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "/tmp/craft-center-icon.png"
let s = 1024
guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: s, pixelsHigh: s,
  bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
  colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else { exit(1) }
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: s, height: s).fill()
let shape = NSBezierPath(roundedRect: NSRect(x: 37, y: 37, width: 950, height: 950), xRadius: 220, yRadius: 220)
let gradient = NSGradient(starting: NSColor(srgbRed: 0.58, green: 0.94, blue: 0.72, alpha: 1.0),
    ending: NSColor(srgbRed: 0.36, green: 0.75, blue: 0.84, alpha: 1.0))!
gradient.draw(in: shape, angle: 140)
let style=NSMutableParagraphStyle()
style.alignment = .center
let font = NSFont(name: "Arial-BoldMT", size: 730) ?? NSFont.boldSystemFont(ofSize: 730)
("C" as NSString).draw(in: NSRect(x: 145, y: 132, width: 760, height: 794), withAttributes:[
  .font: font, .foregroundColor: NSColor(srgbRed: 0.035, green: 0.12, blue: 0.115, alpha: 1),
  .paragraphStyle: style
])
NSColor(srgbRed: 0.91, green: 0.77, blue: 0.50, alpha: 1).setFill()
NSBezierPath(ovalIn: NSRect(x: 783, y: 80, width: 153, height: 153)).fill()
NSGraphicsContext.restoreGraphicsState()
guard let png=bitmap.representation(using: .png, properties: [:]) else {exit(2)}
try png.write(to: URL(fileURLWithPath:filename))
print("ICON_GENERATED=\(filename)")