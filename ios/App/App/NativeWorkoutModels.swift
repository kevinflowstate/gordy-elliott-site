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
    let usesSetLogging: Bool
}

struct NativeWorkoutSet: Codable, Identifiable, Equatable {
    var setNumber: Int
    var weight: String
    var reps: String
    var notes: String
    var completed: Bool

    var id: Int { setNumber }

    enum CodingKeys: String, CodingKey {
        case setNumber = "set_number"
        case weight
        case reps
        case notes
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
