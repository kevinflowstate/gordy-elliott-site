import Capacitor
import SwiftUI
import UIKit
import WebKit

private final class WeakWorkoutScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

@objc(WorkoutBridgeViewController)
final class WorkoutBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private let handlerName = "ATCapacityWorkout"
    private var workoutHost: UIViewController?
#if DEBUG
    private var didLaunchPreviewWorkout = false
#endif

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.configuration.userContentController.add(
            WeakWorkoutScriptMessageHandler(delegate: self),
            name: handlerName
        )
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
#if DEBUG
        guard !didLaunchPreviewWorkout,
              ProcessInfo.processInfo.arguments.contains("-NativeWorkoutPreview") else {
            return
        }
        didLaunchPreviewWorkout = true
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(Self.previewLaunch),
              let object = try? JSONSerialization.jsonObject(with: data) else {
            return
        }
        openWorkout(object)
#endif
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: handlerName)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == handlerName,
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }

        switch action {
        case "open":
            openWorkout(body["payload"])
        case "requestPending":
            sendPendingWorkouts()
        case "ackPending":
            if let id = body["id"] as? String {
                NativeWorkoutDiskStore.shared.acknowledgePending(id: id)
            }
        default:
            break
        }
    }

    private func openWorkout(_ rawPayload: Any?) {
        guard workoutHost == nil,
              let rawPayload,
              JSONSerialization.isValidJSONObject(rawPayload),
              let data = try? JSONSerialization.data(withJSONObject: rawPayload),
              let launch = try? JSONDecoder().decode(NativeWorkoutLaunch.self, from: data),
              launch.schemaVersion == 1,
              !launch.session.exercises.isEmpty else {
            dispatchEvent(name: "atcapacity:native-workout-unavailable", detail: ["reason": "invalid-payload"])
            return
        }

        let rootView = NativeWorkoutView(
            launch: launch,
            onClose: { [weak self] in
                self?.closeWorkout()
            },
            onPending: { [weak self] pending in
                self?.dispatchEncodableEvent(name: "atcapacity:native-workout-pending", detail: pending)
            }
        )
        let host = UIHostingController(rootView: rootView)
        host.view.backgroundColor = UIColor(red: 0.035, green: 0.035, blue: 0.043, alpha: 1)
        host.modalPresentationStyle = .fullScreen
        workoutHost = host
        present(host, animated: true)
    }

    private func closeWorkout() {
        guard let workoutHost else { return }
        workoutHost.dismiss(animated: true) { [weak self] in
            self?.workoutHost = nil
            self?.dispatchEvent(name: "atcapacity:native-workout-closed", detail: [:])
        }
    }

    private func sendPendingWorkouts() {
        for pending in NativeWorkoutDiskStore.shared.pendingWorkouts() {
            dispatchEncodableEvent(name: "atcapacity:native-workout-pending", detail: pending)
        }
    }

    private func dispatchEncodableEvent<T: Encodable>(name: String, detail: T) {
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(detail),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        dispatchEvent(name: name, jsonDetail: json)
    }

    private func dispatchEvent(name: String, detail: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(detail),
              let data = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        dispatchEvent(name: name, jsonDetail: json)
    }

    private func dispatchEvent(name: String, jsonDetail: String) {
        guard let nameData = try? JSONEncoder().encode(name),
              let encodedName = String(data: nameData, encoding: .utf8) else {
            return
        }
        webView?.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent(\(encodedName), { detail: \(jsonDetail) }));"
        )
    }
}

#if DEBUG
private extension WorkoutBridgeViewController {
    static let previewLaunch = NativeWorkoutLaunch(
        schemaVersion: 1,
        session: NativeWorkoutSession(
            id: "qa-native-session",
            name: "Full Body Strength",
            notes: "Move with intent. Leave one clean rep in reserve.",
            exercises: [
                NativeWorkoutExercise(id: "qa-squat", name: "Back Squat", prescription: "3 × 6", section: "Main strength", restSeconds: 90, notes: "Control the descent and drive through mid-foot.", demoURL: nil, usesSetLogging: true),
                NativeWorkoutExercise(id: "qa-rdl", name: "Romanian Deadlift", prescription: "3 × 8", section: "Main strength", restSeconds: 90, notes: nil, demoURL: nil, usesSetLogging: true),
                NativeWorkoutExercise(id: "qa-press", name: "Incline Dumbbell Press", prescription: "3 × 8", section: "Upper body", restSeconds: 60, notes: nil, demoURL: nil, usesSetLogging: true),
                NativeWorkoutExercise(id: "qa-plank", name: "Side Plank", prescription: "30 sec each side", section: "Core finisher", restSeconds: 30, notes: nil, demoURL: nil, usesSetLogging: false),
            ]
        ),
        date: "2026-08-18",
        dateLabel: "Today",
        mode: "workout",
        sets: [
            "qa-squat": (1...3).map { NativeWorkoutSet(setNumber: $0, weight: "", reps: "", notes: "", completed: false) },
            "qa-rdl": (1...3).map { NativeWorkoutSet(setNumber: $0, weight: "", reps: "", notes: "", completed: false) },
            "qa-press": (1...3).map { NativeWorkoutSet(setNumber: $0, weight: "", reps: "", notes: "", completed: false) },
            "qa-plank": [NativeWorkoutSet(setNumber: 1, weight: "", reps: "", notes: "", completed: false)],
        ],
        startedAt: nil
    )
}
#endif
