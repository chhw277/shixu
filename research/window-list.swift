import Foundation
import CoreGraphics
let taskPID = Int(CommandLine.arguments.last ?? "0") ?? 0
let windows = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
for w in windows where (w[kCGWindowOwnerPID as String] as? Int ?? 0) == taskPID { print(w) }
print("screenRecordingAllowed", CGPreflightScreenCaptureAccess())
