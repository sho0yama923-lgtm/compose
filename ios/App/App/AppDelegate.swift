import UIKit
import Capacitor
import AVFAudio

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UIWindowSceneDelegate {

    var window: UIWindow?
    private var didRegisterCustomPlugins = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        configureAudioSession()
        return true
    }

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            print("Failed to configure AVAudioSession: \(error.localizedDescription)")
        }
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        registerCustomPluginsIfNeeded()
    }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        if let windowScene = scene as? UIWindowScene {
            window = windowScene.windows.first
        }
        registerCustomPluginsIfNeeded()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        if let windowScene = scene as? UIWindowScene {
            window = windowScene.windows.first
        }
        registerCustomPluginsIfNeeded()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Capacitor の URL open ハンドリングへ渡す。
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Universal Links などの activity を Capacitor へ渡す。
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    private func registerCustomPluginsIfNeeded() {
        guard !didRegisterCustomPlugins else { return }
        guard let bridgeViewController = resolveBridgeViewController(),
              let bridge = bridgeViewController.bridge else {
            return
        }
        bridge.registerPluginInstance(NativePlaybackPlugin())
        didRegisterCustomPlugins = true
    }

    private func resolveBridgeViewController() -> CAPBridgeViewController? {
        if let bridgeViewController = window?.rootViewController as? CAPBridgeViewController {
            return bridgeViewController
        }

        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            if let bridgeViewController = windowScene.windows.first?.rootViewController as? CAPBridgeViewController {
                window = windowScene.windows.first
                return bridgeViewController
            }
        }

        return nil
    }

}
