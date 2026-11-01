import SwiftUI
import UIKit

/// A file ready to share (used with `.sheet(item:)`).
struct SharedFile: Identifiable {
    let id = UUID()
    let url: URL
}

/// The system share / save sheet (UIActivityViewController).
struct ShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
