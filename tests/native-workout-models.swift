import Foundation

@main
struct NativeWorkoutModelRegressionChecks {
    static func main() throws {
        var checks = 0
        func check(_ condition: Bool, _ message: String) {
            precondition(condition, message)
            checks += 1
        }

        let longInstructions = "6-min EMOM · odd minutes · 10 calories, then rest for the remainder of the minute"
        let reportedAirBikeInstructions = "arms and legs moving together ; Time 3 min 0 sec"
        check(NativeWorkoutPrescriptionLayout.usesInlineBadge(name: "Air Bike", prescription: "3 x 10", accessibilityText: false), "Short prescriptions can use a capped badge")
        check(!NativeWorkoutPrescriptionLayout.usesInlineBadge(name: "Air Bike", prescription: longInstructions, accessibilityText: false), "Full instructions must sit below the name")
        check(!NativeWorkoutPrescriptionLayout.usesInlineBadge(name: "Air Bike", prescription: reportedAirBikeInstructions, accessibilityText: false), "Andrew’s exact Air Bike prescription must sit below the full name")
        check(!NativeWorkoutPrescriptionLayout.usesInlineBadge(name: "Air Bike", prescription: "10 cals\nRest", accessibilityText: false), "Explicit newlines must survive as instructions")
        check(!NativeWorkoutPrescriptionLayout.usesInlineBadge(name: "Single Leg Romanian Deadlift with Dumbbells", prescription: "3 x 10", accessibilityText: false), "Long names must use the whole width")
        check(!NativeWorkoutPrescriptionLayout.usesInlineBadge(name: "Air Bike", prescription: "3 x 10", accessibilityText: true), "Accessibility text must stack")
        check(!NativeWorkoutPrescriptionLayout.usesInlineBadge(name: "Air Bike", prescription: "", accessibilityText: false), "Missing prescriptions must not create an empty badge")

        let decoder = JSONDecoder()
        // Build 10-era payloads remain decodable without grouping/video/timer additions.
        let oldExercise = try decoder.decode(NativeWorkoutExercise.self, from: Data(#"{"id":"bike","name":"Air Bike","prescription":"30 cals","usesSetLogging":false}"#.utf8))
        check(oldExercise.groupID == nil && oldExercise.demoURL == nil, "Old payloads remain compatible")
        check(oldExercise.groupLabel == nil && !oldExercise.logsCircuitRounds, "Ordinary prescriptions stay ordinary")

        var timedSet = NativeWorkoutSet(setNumber: 1, weight: "20", reps: "10", notes: "Controlled", completed: true, circuitRounds: 4)
        let start = 1_800_000_000_000.0
        timedSet.startCircuit(at: start, duration: 360)
        check(timedSet.circuitEndsAt == start + 360_000, "Start stores an absolute deadline in milliseconds")
        check(timedSet.circuitDurationSeconds == 360, "Total timer duration survives resume")
        check(timedSet.circuitTimeRemaining(at: start + 59_500, duration: 360) == 301, "Countdown rounds partial seconds up")
        timedSet.pauseCircuit(at: start + 60_000, duration: 360)
        check(timedSet.circuitEndsAt == nil && timedSet.circuitRemainingSeconds == 300, "Pause stores the remaining duration")
        check(timedSet.circuitTimeRemaining(at: start + 120_000, duration: 360) == 300, "Paused timer does not advance")

        let encoder = JSONEncoder()
        timedSet = try decoder.decode(NativeWorkoutSet.self, from: encoder.encode(timedSet))
        check(timedSet.circuitRemainingSeconds == 300 && timedSet.circuitDurationSeconds == 360, "Paused timer survives disk Codable round trip")
        timedSet.startCircuit(at: start + 120_000, duration: 360)
        check(timedSet.circuitEndsAt == start + 420_000, "Resume starts from saved remaining time")
        check(timedSet.circuitTimeRemaining(at: start + 421_000, duration: 360) == 0, "Elapsed deadline stops at zero")
        timedSet.resetCircuit(duration: 360)
        check(timedSet.circuitEndsAt == nil && timedSet.circuitRemainingSeconds == 360, "Reset restores prescribed duration")
        check(timedSet.circuitRounds == 4 && timedSet.reps == "10" && timedSet.notes == "Controlled" && timedSet.completed, "Timer actions preserve logged work and rounds")

        var manualSet = NativeWorkoutSet(setNumber: 1, weight: "", reps: "", notes: "", completed: false, circuitRemainingSeconds: 90, circuitDurationSeconds: 90)
        manualSet.startCircuit(at: start, duration: nil)
        manualSet.pauseCircuit(at: start + 60_000, duration: nil)
        manualSet.resetCircuit(duration: nil)
        check(manualSet.circuitRemainingSeconds == 90, "Manual timer reset uses saved total duration")
        check(manualSet.circuitDurationSeconds == 90, "Manual total is not replaced by remaining time")

        for (remaining, minute, seconds, parity) in [(360, 1, 60, "odd"), (301, 1, 1, "odd"), (300, 2, 60, "even"), (239, 3, 59, "odd"), (0, 6, 0, "even")] {
            let progress = NativeWorkoutMinuteProgress(duration: 360, remaining: remaining)
            check(progress.minute == minute && progress.secondsRemaining == seconds && progress.parity == parity && progress.minuteCount == 6, "EMOM progression at remaining \(remaining)")
        }
        let partialMinute = NativeWorkoutMinuteProgress(duration: 90, remaining: 30)
        check(partialMinute.minute == 2 && partialMinute.minuteCount == 2 && partialMinute.secondsRemaining == 30, "Partial final minute has the correct remaining time")

        let emom = NativeWorkoutExercise(id: "bike", name: "Air Bike", prescription: longInstructions, section: "Finisher", restSeconds: nil, notes: "Original coach note", demoURL: "https://example.com/demo", groupID: "s:bike", groupKind: "emom", durationSeconds: 360, emomMinuteParity: "odd", usesSetLogging: false)
        var amrap = emom
        amrap.groupKind = "amrap"
        check(emom.groupLabel == "EMOM circuit" && !emom.logsCircuitRounds, "EMOM is named and cannot show rounds")
        check(amrap.groupLabel == "AMRAP circuit" && amrap.logsCircuitRounds, "AMRAP retains round controls")
        let emomLog = emom.setsForSync([timedSet])[0]
        var expectedEMOMLog = timedSet
        expectedEMOMLog.circuitRounds = nil
        check(emomLog == expectedEMOMLog, "EMOM removes only legacy rounds from sync")
        check(amrap.setsForSync([timedSet]) == [timedSet], "AMRAP round logs remain unchanged")
        let payload = NativeWorkoutSyncPayload(sessionID: "s", date: "2026-10-09", sessionStartedAt: nil, entries: [NativeWorkoutSyncEntry(exerciseItemID: emom.id, setsData: [emomLog])])
        let object = try JSONSerialization.jsonObject(with: encoder.encode(payload)) as! [String: Any]
        let entries = object["entries"] as! [[String: Any]]
        let encodedLog = (entries[0]["sets_data"] as! [[String: Any]])[0]
        check(entries[0]["exercise_item_id"] as? String == "bike", "Sync preserves original exercise item IDs")
        check(encodedLog["circuit_rounds"] == nil && encodedLog["reps"] as? String == "10" && encodedLog["notes"] as? String == "Controlled", "Encoded EMOM payload preserves results without round logging")

        let launch = NativeWorkoutLaunch(schemaVersion: 1, session: NativeWorkoutSession(id: "s", name: "Finisher", notes: "Complete in order", exercises: [emom, amrap]), date: "2026-10-09", dateLabel: "Friday", mode: "workout", sets: ["bike": [timedSet]], startedAt: start)
        let draft = NativeWorkoutDraft(sessionID: "s", date: launch.date, mode: "workout", savedAt: Date(), launch: launch, stage: "exercise", exerciseIndex: 0, startedAt: Date(timeIntervalSince1970: start / 1_000), sets: launch.sets)
        let resumed = try decoder.decode(NativeWorkoutDraft.self, from: encoder.encode(draft))
        check(resumed.launch.session.exercises[0].prescription == longInstructions, "Draft restores the entire coach prescription")
        check(resumed.launch.session.exercises[0].demoURL == emom.demoURL && resumed.launch.session.exercises[0].groupID == emom.groupID && resumed.launch.session.exercises[0].emomMinuteParity == "odd", "Draft restores demos, grouping and minute cues")
        check(resumed.sets["bike"] == [timedSet] && resumed.stage == "exercise" && resumed.exerciseIndex == 0, "Draft restores results, rounds and workout position")
        print("Native workout model checks passed (\(checks) assertions).")
    }
}
