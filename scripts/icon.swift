import AppKit
let directory = CommandLine.arguments[1]
let size = 1024
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
let context = NSGraphicsContext(bitmapImageRep: bitmap)!
NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current = context
NSColor.clear.setFill(); NSRect(x:0,y:0,width:1024,height:1024).fill()
let shadow = NSShadow();shadow.shadowColor = NSColor.black.withAlphaComponent(0.12);shadow.shadowOffset = NSSize(width:0,height:-12);shadow.shadowBlurRadius=20;shadow.set()
let outer = NSBezierPath(roundedRect: NSRect(x:44,y:44,width:936,height:936), xRadius:210,yRadius:210)
NSColor(srgbRed:0.96,green:0.97,blue:0.99,alpha:1).setFill();outer.fill()
NSShadow().set()
let tile=NSBezierPath(roundedRect: NSRect(x:151,y:151,width:722,height:722),xRadius:168,yRadius:168)
let gradient=NSGradient(starting:NSColor(srgbRed:0.30,green:0.44,blue:0.91,alpha:1),ending:NSColor(srgbRed:0.22,green:0.36,blue:0.83,alpha:1))!
gradient.draw(in:tile,angle:90)
let line=NSBezierPath();line.lineWidth=40;line.lineCapStyle = .round;line.lineJoinStyle = .round
line.move(to:NSPoint(x:278,y:512));line.line(to:NSPoint(x:419,y:372));line.line(to:NSPoint(x:689,y:641))
line.move(to:NSPoint(x:516,y:389));line.line(to:NSPoint(x:565,y:341));line.line(to:NSPoint(x:782,y:556))
NSColor.white.setStroke();line.stroke()
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using:.png,properties:[:])!.write(to: URL(fileURLWithPath:directory).appendingPathComponent("icon_512x512@2x.png"))
