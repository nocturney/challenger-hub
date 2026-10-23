import Foundation
import CoreGraphics
let windows=CGWindowListCopyWindowInfo([.optionOnScreenOnly,.excludeDesktopElements],kCGNullWindowID) as? [[String:Any]] ?? []
for w in windows {
 let owner=w[kCGWindowOwnerName as String] as? String ?? ""
 let title=w[kCGWindowName as String] as? String ?? ""
 if owner.lowercased().contains("challenger") || title.lowercased().contains("challenger") {
  let num=w[kCGWindowNumber as String] as? Int ?? 0
  let pid=w[kCGWindowOwnerPID as String] as? Int ?? 0
  print("\(num) | \(pid) | \(owner) | \(title)")
 }
}