import SwiftUI
import UIKit
import UserNotifications

/// Asks for notification permission and registers with APNs. Call once after login.
enum PushRegistration {
    @MainActor
    static func start() async {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        if granted {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
}

/// Receives the APNs token and notification taps. Wired in ScoolApp with @UIApplicationDelegateAdaptor.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    /// Set by ScoolApp. Called on the main thread with the hex device token.
    static var onToken: (@MainActor (String) -> Void)?
    /// Set by ScoolApp. Called with the push payload's `deepLink` and `childId`.
    static var onOpen: (@MainActor (DeepLink, String?) -> Void)?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in Self.onToken?(token) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Normal on the simulator or without the Push Notifications capability. Nothing to do.
    }

    /// Show pushes as banners while the app is open.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }

    /// Payload: { "type": "...", "childId": "ch1", "deepLink": "scool://fees" }
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        let link = (info["deepLink"] as? String).flatMap { DeepLink(url: $0) }
        let childId = info["childId"] as? String
        Task { @MainActor in
            if let link { Self.onOpen?(link, childId) }
        }
        completionHandler()
    }
}
