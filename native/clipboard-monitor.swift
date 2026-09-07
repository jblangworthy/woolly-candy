import AppKit
import Foundation

setbuf(stdout, nil)

let pasteboard = NSPasteboard.general
var lastCount = pasteboard.changeCount

while true {
    let current = pasteboard.changeCount
    if current != lastCount {
        print(current)
        lastCount = current
    }
    Thread.sleep(forTimeInterval: 0.1)
}
