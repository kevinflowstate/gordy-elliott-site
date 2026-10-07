import Foundation

struct NativeWorkoutLaunch: Codable {
    let schemaVersion: Int
    let session: NativeWorkoutSession
    let date: String
    let dateLabel: String
    let mode: String
    let sets: [String: [NativeWorkoutSet]]
    let startedAt: Double?
}

struct NativeWorkoutSession: Codable {
    let id: String
    let name: String
    let notes: String?
    let exercises: [NativeWorkoutExercise]
}

struct NativeWorkoutExercise: Codable, Identifiable {
    let id: String
    let name: String
    let prescription: String
    let section: String?
    let restSeconds: Int?
    let notes: String?
    let demoURL: String?
    var groupID: String? = nil
    var groupKind: String? = nil
    var durationSeconds: Int? = nil
    var emomMinuteParity: String? = nil
    let usesSetLogging: Bool

    var logsCircuitRounds: Bool {
        groupKind == "amrap" || groupKind == "circuit"
    }

    var groupLabel: String? {
        switch groupKind {
        case "superset": return "Superset"
        case "circuit": return "Circuit"
        case "amrap": return "AMRAP circuit"
        case "emom": return "EMOM circuit"
        default: return nil
        }
    }

    func setsForSync(_ sets: [NativeWorkoutSet]) -> [NativeWorkoutSet] {
        guard groupKind == "emom" else { return sets }
        return sets.map { value in
            var value = value
            value.circuitRounds = nil
            return value
        }
    }
}

enum NativeWorkoutPrescriptionLayout {
    // Longer names and accessibility text get the entire row; short badges have a width cap in the view.
    static func usesInlineBadge(name: String, prescription: String, accessibilityText: Bool) -> Bool {
        !accessibilityText && name.count <= 32 && prescription.count <= 18
            && !prescription.isEmpty && !prescription.contains(where: { $0.isNewline })
    }
}

struct NativeWorkoutMinuteProgress: Equatable {
    let minute: Int
    let minuteCount: Int
    let secondsRemaining: Int
    let parity: String

    init(duration: Int, remaining: Int) {
        let remaining = min(max(0, remaining), max(0, duration))
        let elapsed = max(0, duration - remaining)
        minuteCount = max(1, (duration + 59) / 60)
        minute = remaining == 0 ? minuteCount : elapsed / 60 + 1
        secondsRemaining = remaining == 0 ? 0 : min(60 - elapsed % 60, remaining)
        parity = minute % 2 == 1 ? "odd" : "even"
    }
}

struct NativeWorkoutSet: Codable, Identifiable, Equatable {
    var setNumber: Int
    var weight: String
    var reps: String
    var notes: String
    var completed: Bool
    var circuitRounds: Int? = nil
    var circuitEndsAt: Double? = nil
    var circuitRemainingSeconds: Int? = nil
    var circuitDurationSeconds: Int? = nil

    var id: Int { setNumber }

    func circuitTimeRemaining(at milliseconds: Double, duration: Int?) -> Int? {
        if let end = circuitEndsAt, end > 0 {
            return max(0, Int(ceil((end - milliseconds) / 1_000)))
        }
        return circuitRemainingSeconds ?? duration
    }

    mutating func pauseCircuit(at milliseconds: Double, duration: Int?) {
        circuitRemainingSeconds = circuitTimeRemaining(at: milliseconds, duration: duration)
        circuitEndsAt = nil
    }

    mutating func startCircuit(at milliseconds: Double, duration: Int?) {
        guard let remaining = circuitTimeRemaining(at: milliseconds, duration: duration), remaining > 0 else { return }
        if circuitDurationSeconds == nil { circuitDurationSeconds = duration ?? remaining }
        circuitEndsAt = milliseconds + Double(remaining) * 1_000
    }

    mutating func resetCircuit(duration: Int?) {
        circuitEndsAt = nil
        circuitRemainingSeconds = duration ?? circuitDurationSeconds
    }

    enum CodingKeys: String, CodingKey {
        case setNumber = "set_number"
        case weight
        case reps
        case notes
        case circuitRounds = "circuit_rounds"
        case circuitEndsAt = "circuit_ends_at"
        case circuitRemainingSeconds = "circuit_remaining_seconds"
        case circuitDurationSeconds = "circuit_duration_seconds"
        case completed
    }
}

struct NativeWorkoutSyncPayload: Codable {
    let sessionID: String
    let date: String
    let sessionStartedAt: String?
    let entries: [NativeWorkoutSyncEntry]

    enum CodingKeys: String, CodingKey {
        case sessionID = "session_id"
        case date
        case sessionStartedAt = "session_started_at"
        case entries
    }
}

struct NativeWorkoutSyncEntry: Codable {
    let exerciseItemID: String
    let setsData: [NativeWorkoutSet]

    enum CodingKeys: String, CodingKey {
        case exerciseItemID = "exercise_item_id"
        case setsData = "sets_data"
    }
}

struct PendingNativeWorkout: Codable, Identifiable {
    let id: String
    let createdAt: Date
    let payload: NativeWorkoutSyncPayload
}

struct NativeWorkoutDraft: Codable {
    let sessionID: String
    let date: String
    let mode: String
    let savedAt: Date
    let launch: NativeWorkoutLaunch
    let stage: String
    let exerciseIndex: Int
    let startedAt: Date?
    let sets: [String: [NativeWorkoutSet]]
}

private struct NativeWorkoutPersistedState: Codable {
    var activeDraft: NativeWorkoutDraft?
    var pending: [PendingNativeWorkout]

    static let empty = NativeWorkoutPersistedState(activeDraft: nil, pending: [])
}

final class NativeWorkoutDiskStore {
    static let shared = NativeWorkoutDiskStore()

    private let stateURL: URL
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    private init(fileManager: FileManager = .default) {
        let baseURL = try? fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = (baseURL ?? fileManager.temporaryDirectory)
            .appendingPathComponent("ATCapacity", isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        stateURL = directory.appendingPathComponent("native-workout-state-v1.json")
        encoder.outputFormatting = [.sortedKeys]
    }

    func matchingDraft(for launch: NativeWorkoutLaunch) -> NativeWorkoutDraft? {
        guard let draft = load().activeDraft,
              draft.sessionID == launch.session.id,
              draft.date == launch.date,
              draft.mode == launch.mode,
              Date().timeIntervalSince(draft.savedAt) < 6 * 60 * 60 else {
            return nil
        }
        return draft
    }

    func save(draft: NativeWorkoutDraft) {
        var state = load()
        state.activeDraft = draft
        try? write(state)
    }

    func queue(payload: NativeWorkoutSyncPayload) -> PendingNativeWorkout? {
        var state = load()
        let pending = PendingNativeWorkout(
            id: UUID().uuidString,
            createdAt: Date(),
            payload: payload
        )
        state.activeDraft = nil
        state.pending.removeAll { item in
            item.payload.sessionID == payload.sessionID && item.payload.date == payload.date
        }
        state.pending.append(pending)
        do {
            try write(state)
            return pending
        } catch {
            return nil
        }
    }

    func pendingWorkouts() -> [PendingNativeWorkout] {
        load().pending
    }

    func acknowledgePending(id: String) {
        var state = load()
        state.pending.removeAll { $0.id == id }
        try? write(state)
    }

    private func load() -> NativeWorkoutPersistedState {
        guard let data = try? Data(contentsOf: stateURL),
              let state = try? decoder.decode(NativeWorkoutPersistedState.self, from: data) else {
            return .empty
        }
        return state
    }

    private func write(_ state: NativeWorkoutPersistedState) throws {
        let data = try encoder.encode(state)
        try data.write(to: stateURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
}
