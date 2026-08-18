import SwiftUI

enum NativeWorkoutStage: String {
    case preview
    case exercise
    case review
    case complete
}

@MainActor
final class NativeWorkoutViewModel: ObservableObject {
    @Published private(set) var stage: NativeWorkoutStage
    @Published private(set) var exerciseIndex: Int
    @Published private(set) var startedAt: Date?
    @Published private(set) var sets: [String: [NativeWorkoutSet]]
    @Published private(set) var restEndsAt: Date?

    let launch: NativeWorkoutLaunch
    private let store: NativeWorkoutDiskStore

    init(launch: NativeWorkoutLaunch, store: NativeWorkoutDiskStore = .shared) {
        self.launch = launch
        self.store = store

        if let draft = store.matchingDraft(for: launch),
           let restoredStage = NativeWorkoutStage(rawValue: draft.stage) {
            stage = restoredStage == .complete ? .review : restoredStage
            exerciseIndex = min(max(0, draft.exerciseIndex), max(0, launch.session.exercises.count - 1))
            startedAt = draft.startedAt
            sets = draft.sets
        } else {
            stage = launch.mode == "edit" ? .exercise : .preview
            exerciseIndex = 0
            startedAt = launch.startedAt.map { Date(timeIntervalSince1970: $0 / 1_000) }
            sets = launch.sets
        }
    }

    var currentExercise: NativeWorkoutExercise? {
        guard launch.session.exercises.indices.contains(exerciseIndex) else { return nil }
        return launch.session.exercises[exerciseIndex]
    }

    var completedSetCount: Int {
        sets.values.flatMap { $0 }.filter(\.completed).count
    }

    var totalSetCount: Int {
        sets.values.reduce(0) { $0 + $1.count }
    }

    var progress: Double {
        guard !launch.session.exercises.isEmpty else { return 0 }
        if stage == .preview { return 0 }
        if stage == .review || stage == .complete { return 1 }
        return Double(exerciseIndex + 1) / Double(launch.session.exercises.count)
    }

    func start() {
        if startedAt == nil && launch.mode != "edit" {
            startedAt = Date()
        }
        stage = .exercise
        persist()
    }

    func goBack() {
        guard exerciseIndex > 0 else {
            stage = .preview
            persist()
            return
        }
        exerciseIndex -= 1
        stage = .exercise
        persist()
    }

    func goNext() {
        if exerciseIndex >= launch.session.exercises.count - 1 {
            stage = .review
        } else {
            exerciseIndex += 1
            stage = .exercise
        }
        persist()
    }

    func jump(to index: Int) {
        guard launch.session.exercises.indices.contains(index) else { return }
        exerciseIndex = index
        stage = .exercise
        persist()
    }

    func updateSet(exerciseID: String, index: Int, update: (inout NativeWorkoutSet) -> Void) {
        guard sets[exerciseID]?.indices.contains(index) == true else { return }
        update(&sets[exerciseID]![index])
        persist()
    }

    func toggleSet(exerciseID: String, index: Int, restSeconds: Int?) {
        updateSet(exerciseID: exerciseID, index: index) { set in
            set.completed.toggle()
            if set.completed, let restSeconds, restSeconds > 0 {
                restEndsAt = Date().addingTimeInterval(TimeInterval(restSeconds))
            }
        }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    func applyFirstSetToAll(exerciseID: String) {
        guard let first = sets[exerciseID]?.first, (sets[exerciseID]?.count ?? 0) > 1 else { return }
        for index in 1..<(sets[exerciseID]?.count ?? 1) {
            updateSet(exerciseID: exerciseID, index: index) { set in
                set.weight = first.weight
                set.reps = first.reps
            }
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    func addSet(exerciseID: String) {
        var exerciseSets = sets[exerciseID] ?? []
        exerciseSets.append(NativeWorkoutSet(
            setNumber: exerciseSets.count + 1,
            weight: "",
            reps: "",
            notes: "",
            completed: false
        ))
        sets[exerciseID] = exerciseSets
        persist()
    }

    func skipRest() {
        restEndsAt = nil
    }

    func review() {
        stage = .review
        persist()
    }

    func finish() -> PendingNativeWorkout? {
        let formatter = ISO8601DateFormatter()
        let payload = NativeWorkoutSyncPayload(
            sessionID: launch.session.id,
            date: launch.date,
            sessionStartedAt: startedAt.map { formatter.string(from: $0) },
            entries: launch.session.exercises.map { exercise in
                NativeWorkoutSyncEntry(
                    exerciseItemID: exercise.id,
                    setsData: sets[exercise.id] ?? []
                )
            }
        )
        guard let pending = store.queue(payload: payload) else { return nil }
        stage = .complete
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        return pending
    }

    func persist() {
        guard stage != .complete else { return }
        store.save(draft: NativeWorkoutDraft(
            sessionID: launch.session.id,
            date: launch.date,
            mode: launch.mode,
            savedAt: Date(),
            launch: launch,
            stage: stage.rawValue,
            exerciseIndex: exerciseIndex,
            startedAt: startedAt,
            sets: sets
        ))
    }
}

struct NativeWorkoutView: View {
    @StateObject private var model: NativeWorkoutViewModel
    @State private var showsOverview = false
    @State private var confirmsClose = false
    @State private var saveFailed = false
    @Environment(\.scenePhase) private var scenePhase

    let onClose: () -> Void
    let onPending: (PendingNativeWorkout) -> Void

    init(
        launch: NativeWorkoutLaunch,
        onClose: @escaping () -> Void,
        onPending: @escaping (PendingNativeWorkout) -> Void
    ) {
        _model = StateObject(wrappedValue: NativeWorkoutViewModel(launch: launch))
        self.onClose = onClose
        self.onPending = onPending
    }

    var body: some View {
        ZStack {
            NativeWorkoutPalette.background.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                Group {
                    switch model.stage {
                    case .preview:
                        preview
                    case .exercise:
                        exercise
                    case .review:
                        review
                    case .complete:
                        complete
                    }
                }
            }

            if let restEndsAt = model.restEndsAt, model.stage == .exercise {
                restTimer(until: restEndsAt)
            }
        }
        .foregroundColor(.white)
        .tint(.white)
        .preferredColorScheme(.dark)
        .statusBar(hidden: false)
        .sheet(isPresented: $showsOverview) {
            NativeWorkoutOverviewView(model: model, isPresented: $showsOverview)
        }
        .alert("Leave this workout?", isPresented: $confirmsClose) {
            Button("Keep training", role: .cancel) {}
            Button("Leave workout", role: .destructive) { onClose() }
        } message: {
            Text("Your progress is saved on this iPhone. You can continue from the same place later.")
        }
        .alert("Workout could not be saved", isPresented: $saveFailed) {
            Button("Try again", role: .cancel) {}
        } message: {
            Text("Your logged values are still on screen. Free up a little iPhone storage if needed, then try again.")
        }
        .onChange(of: scenePhase) { phase in
            if phase != .active { model.persist() }
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                Button {
                    if model.stage == .complete { onClose() } else { confirmsClose = true }
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 17, weight: .bold))
                        .frame(width: 44, height: 44)
                        .background(Color.white.opacity(0.07), in: Circle())
                }
                .accessibilityLabel("Close workout")

                VStack(alignment: .leading, spacing: 3) {
                    Text(model.launch.session.name.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .tracking(1.4)
                        .foregroundColor(NativeWorkoutPalette.pink)
                        .lineLimit(1)

                    if model.launch.mode == "edit" {
                        Text("Editing saved session")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.white.opacity(0.65))
                    } else {
                        NativeWorkoutElapsedTime(startedAt: model.startedAt)
                    }
                }

                Spacer(minLength: 8)

                if model.stage == .exercise {
                    Button {
                        showsOverview = true
                    } label: {
                        HStack(spacing: 7) {
                            Text("\(model.exerciseIndex + 1)/\(model.launch.session.exercises.count)")
                            Image(systemName: "list.bullet")
                                .foregroundColor(NativeWorkoutPalette.pink)
                        }
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 13)
                        .frame(height: 44)
                        .background(Color.white.opacity(0.07), in: Capsule())
                    }
                    .accessibilityLabel("Session overview")
                } else {
                    Text(model.stage == .preview ? model.launch.dateLabel : model.stage == .review ? "Review" : "Complete")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.white.opacity(0.5))
                }
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.08))
                    Capsule()
                        .fill(NativeWorkoutPalette.pink)
                        .frame(width: geometry.size.width * model.progress)
                        .animation(.easeOut(duration: 0.25), value: model.progress)
                }
            }
            .frame(height: 4)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
        .background(NativeWorkoutPalette.background.opacity(0.98))
    }

    private var preview: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Spacer(minLength: 34)
                    Text(model.launch.dateLabel.uppercased())
                        .font(.caption.weight(.bold))
                        .tracking(2)
                        .foregroundColor(NativeWorkoutPalette.pink)
                    Text(model.launch.session.name)
                        .font(.system(size: 40, weight: .black, design: .rounded))
                        .tracking(-1.5)
                        .padding(.top, 10)
                    if let notes = model.launch.session.notes, !notes.isEmpty {
                        Text(notes)
                            .font(.body)
                            .foregroundColor(.white.opacity(0.58))
                            .padding(.top, 14)
                    }

                    HStack(spacing: 12) {
                        metric(value: "\(model.launch.session.exercises.count)", label: "Exercises")
                        metric(value: "\(model.totalSetCount)", label: "Working sets")
                    }
                    .padding(.top, 28)

                    VStack(spacing: 9) {
                        ForEach(Array(model.launch.session.exercises.enumerated()), id: \.element.id) { index, exercise in
                            HStack(spacing: 12) {
                                Text("\(index + 1)")
                                    .font(.caption.weight(.bold))
                                    .foregroundColor(NativeWorkoutPalette.pink)
                                    .frame(width: 34, height: 34)
                                    .background(NativeWorkoutPalette.pink.opacity(0.13), in: Circle())
                                VStack(alignment: .leading, spacing: 3) {
                                    if let section = exercise.section {
                                        Text(section.uppercased())
                                            .font(.system(size: 9, weight: .bold))
                                            .tracking(1)
                                            .foregroundColor(.white.opacity(0.3))
                                    }
                                    Text(exercise.name)
                                        .font(.subheadline.weight(.bold))
                                }
                                Spacer()
                                Text(exercise.prescription)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(.white.opacity(0.42))
                            }
                            .padding(13)
                            .background(NativeWorkoutPalette.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color.white.opacity(0.06)))
                        }
                    }
                    .padding(.top, 22)
                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 16)
            }

            primaryButton(model.startedAt == nil ? "Start workout" : "Continue workout") {
                model.start()
            }
            .padding(16)
            .background(NativeWorkoutPalette.background.opacity(0.98))
        }
    }

    @ViewBuilder
    private var exercise: some View {
        if let exercise = model.currentExercise {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        if let section = exercise.section {
                            Text(section.uppercased())
                                .font(.caption.weight(.bold))
                                .tracking(2)
                                .foregroundColor(NativeWorkoutPalette.pink)
                        }
                        Text("Exercise \(model.exerciseIndex + 1) of \(model.launch.session.exercises.count)")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.white.opacity(0.38))
                            .padding(.top, exercise.section == nil ? 0 : 9)
                        HStack(alignment: .top, spacing: 10) {
                            Text(exercise.name)
                                .font(.system(size: 31, weight: .black, design: .rounded))
                                .tracking(-1)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 8)
                            Text(exercise.prescription)
                                .font(.caption.weight(.bold))
                                .foregroundColor(NativeWorkoutPalette.pink)
                                .padding(.horizontal, 11)
                                .padding(.vertical, 8)
                                .background(NativeWorkoutPalette.pink.opacity(0.12), in: RoundedRectangle(cornerRadius: 11))
                        }
                        .padding(.top, 5)

                        if let notes = exercise.notes, !notes.isEmpty {
                            Text(notes)
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.58))
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(NativeWorkoutPalette.card, in: RoundedRectangle(cornerRadius: 16))
                                .padding(.top, 14)
                        }

                        HStack {
                            Text("LOG YOUR WORK")
                                .font(.caption.weight(.bold))
                                .tracking(1.2)
                                .foregroundColor(.white.opacity(0.55))
                            Spacer()
                            if exercise.usesSetLogging, (model.sets[exercise.id]?.count ?? 0) > 1 {
                                Button("Apply set 1 to all") {
                                    model.applyFirstSetToAll(exerciseID: exercise.id)
                                }
                                .font(.caption.weight(.bold))
                                .foregroundColor(NativeWorkoutPalette.pink)
                            }
                        }
                        .padding(.top, 24)

                        VStack(spacing: 11) {
                            ForEach(Array((model.sets[exercise.id] ?? []).enumerated()), id: \.element.id) { index, set in
                                NativeWorkoutSetCard(
                                    set: set,
                                    usesSetLogging: exercise.usesSetLogging,
                                    prescription: exercise.prescription,
                                    onWeightChanged: { value in
                                        model.updateSet(exerciseID: exercise.id, index: index) { $0.weight = value }
                                    },
                                    onRepsChanged: { value in
                                        model.updateSet(exerciseID: exercise.id, index: index) { $0.reps = value }
                                    },
                                    onNotesChanged: { value in
                                        model.updateSet(exerciseID: exercise.id, index: index) { $0.notes = value }
                                    },
                                    onToggle: {
                                        model.toggleSet(exerciseID: exercise.id, index: index, restSeconds: exercise.restSeconds)
                                    }
                                )
                            }
                        }
                        .padding(.top, 12)

                        if exercise.usesSetLogging {
                            Button("+ Add another set") {
                                model.addSet(exerciseID: exercise.id)
                            }
                            .font(.subheadline.weight(.bold))
                            .foregroundColor(.white.opacity(0.58))
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.14), style: StrokeStyle(lineWidth: 1, dash: [6])))
                            .padding(.top, 12)
                        }
                        Spacer(minLength: 28)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 18)
                }

                VStack(spacing: 10) {
                    if model.exerciseIndex + 1 < model.launch.session.exercises.count {
                        Button {
                            model.jump(to: model.exerciseIndex + 1)
                        } label: {
                            HStack {
                                Text("UP NEXT")
                                    .font(.system(size: 9, weight: .black))
                                    .tracking(1.4)
                                    .foregroundColor(NativeWorkoutPalette.pink)
                                Text(model.launch.session.exercises[model.exerciseIndex + 1].name)
                                    .font(.caption.weight(.bold))
                                    .lineLimit(1)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption.weight(.bold))
                                    .foregroundColor(.white.opacity(0.3))
                            }
                            .padding(.horizontal, 14)
                            .frame(minHeight: 46)
                            .background(NativeWorkoutPalette.card, in: RoundedRectangle(cornerRadius: 14))
                        }
                    }
                    HStack(spacing: 11) {
                        secondaryButton("Previous", systemImage: "chevron.left") { model.goBack() }
                        primaryButton(model.exerciseIndex == model.launch.session.exercises.count - 1 ? "Review workout" : "Next exercise") {
                            model.goNext()
                        }
                    }
                }
                .padding(16)
                .background(NativeWorkoutPalette.background.opacity(0.98))
            }
        }
    }

    private var review: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text(model.launch.mode == "edit" ? "REVIEW CHANGES" : "FINAL CHECK")
                        .font(.caption.weight(.bold))
                        .tracking(2)
                        .foregroundColor(NativeWorkoutPalette.pink)
                    Text(model.launch.mode == "edit" ? "Save your updates" : "Review your session")
                        .font(.system(size: 33, weight: .black, design: .rounded))
                        .tracking(-1)
                        .padding(.top, 7)
                    Text(model.completedSetCount == model.totalSetCount
                         ? "Everything is marked complete. Save when you’re happy with the session."
                         : "\(model.totalSetCount - model.completedSetCount) sets are still unmarked. You can go back or save the session as it is.")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.55))
                        .padding(.top, 9)

                    VStack(spacing: 10) {
                        ForEach(Array(model.launch.session.exercises.enumerated()), id: \.element.id) { index, exercise in
                            let exerciseSets = model.sets[exercise.id] ?? []
                            let done = !exerciseSets.isEmpty && exerciseSets.allSatisfy(\.completed)
                            Button {
                                model.jump(to: index)
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: done ? "checkmark" : "\(index + 1).circle.fill")
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(done ? .black : .white.opacity(0.5))
                                        .frame(width: 38, height: 38)
                                        .background(done ? NativeWorkoutPalette.green : Color.white.opacity(0.07), in: Circle())
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(exercise.name).font(.subheadline.weight(.bold))
                                        Text("\(exerciseSets.filter(\.completed).count)/\(exerciseSets.count) sets complete")
                                            .font(.caption)
                                            .foregroundColor(.white.opacity(0.38))
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .foregroundColor(.white.opacity(0.25))
                                }
                                .padding(14)
                                .background(NativeWorkoutPalette.card, in: RoundedRectangle(cornerRadius: 18))
                            }
                        }
                    }
                    .padding(.top, 22)
                }
                .padding(16)
            }

            primaryButton(model.launch.mode == "edit" ? "Save changes" : "Save and end workout") {
                guard let pending = model.finish() else {
                    saveFailed = true
                    return
                }
                onPending(pending)
            }
            .padding(16)
            .background(NativeWorkoutPalette.background.opacity(0.98))
        }
    }

    private var complete: some View {
        VStack(spacing: 0) {
            Spacer()
            Image(systemName: "checkmark")
                .font(.system(size: 34, weight: .black))
                .foregroundColor(.black)
                .frame(width: 82, height: 82)
                .background(NativeWorkoutPalette.green, in: Circle())
            Text(model.launch.mode == "edit" ? "SESSION UPDATED" : "WORKOUT SAVED")
                .font(.caption.weight(.bold))
                .tracking(2)
                .foregroundColor(NativeWorkoutPalette.pink)
                .padding(.top, 24)
            Text(model.launch.mode == "edit" ? "Changes saved." : "Strong work.")
                .font(.system(size: 39, weight: .black, design: .rounded))
                .tracking(-1.4)
                .padding(.top, 8)
            Text("\(model.completedSetCount) of \(model.totalSetCount) sets logged as complete")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.5))
                .padding(.top, 8)
            Text("Your workout is stored safely on this iPhone and syncs to Gordy automatically when connected.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundColor(.white.opacity(0.42))
                .padding(.top, 18)
                .padding(.horizontal, 38)
            Spacer()
            primaryButton("Back to training") { onClose() }
                .padding(16)
        }
    }

    private func restTimer(until endDate: Date) -> some View {
        VStack {
            Spacer()
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let remaining = max(0, Int(ceil(endDate.timeIntervalSince(context.date))))
                HStack(spacing: 12) {
                    Image(systemName: remaining == 0 ? "checkmark" : "timer")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(remaining == 0 ? .black : .white)
                        .frame(width: 42, height: 42)
                        .background(remaining == 0 ? NativeWorkoutPalette.green : NativeWorkoutPalette.pink, in: Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(remaining == 0 ? "REST COMPLETE" : "REST TIMER")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(1.1)
                            .foregroundColor(.white.opacity(0.42))
                        Text(remaining == 0 ? "Ready for the next set" : "\(remaining)s")
                            .font(.headline.weight(.black))
                    }
                    Spacer()
                    if remaining > 0 {
                        Button("Skip") { model.skipRest() }
                            .font(.caption.weight(.bold))
                            .foregroundColor(.white.opacity(0.65))
                    }
                }
                .padding(13)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(NativeWorkoutPalette.pink.opacity(0.28)))
                .padding(.horizontal, 16)
                .padding(.bottom, 128)
            }
        }
        .allowsHitTesting(true)
    }

    private func metric(value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.system(size: 30, weight: .black, design: .rounded))
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
                .foregroundColor(.white.opacity(0.38))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(NativeWorkoutPalette.card, in: RoundedRectangle(cornerRadius: 18))
    }

    private func primaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.black))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(NativeWorkoutPalette.pink, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
        }
    }

    private func secondaryButton(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.bold))
                .foregroundColor(.white.opacity(0.7))
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 17).stroke(Color.white.opacity(0.1)))
        }
    }
}

private struct NativeWorkoutSetCard: View {
    let set: NativeWorkoutSet
    let usesSetLogging: Bool
    let prescription: String
    let onWeightChanged: (String) -> Void
    let onRepsChanged: (String) -> Void
    let onNotesChanged: (String) -> Void
    let onToggle: () -> Void

    var body: some View {
        VStack(spacing: 9) {
            HStack(alignment: .bottom, spacing: 9) {
                if usesSetLogging {
                    Text("\(set.setNumber)")
                        .font(.subheadline.weight(.black))
                        .foregroundColor(.white.opacity(0.55))
                        .frame(width: 45, height: 48)
                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
                    NativeWorkoutField(label: "WEIGHT", value: set.weight, placeholder: "0", keyboard: .decimalPad, suffix: "kg", onChange: onWeightChanged)
                    NativeWorkoutField(label: "REPS", value: set.reps, placeholder: prescription, keyboard: .numberPad, suffix: nil, onChange: onRepsChanged)
                } else {
                    NativeWorkoutField(label: "RESULT", value: set.reps, placeholder: prescription, keyboard: .default, suffix: nil, onChange: onRepsChanged)
                }
                Button(action: onToggle) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 17, weight: .black))
                        .foregroundColor(set.completed ? .black : .white.opacity(0.3))
                        .frame(width: 48, height: 48)
                        .background(set.completed ? NativeWorkoutPalette.green : Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(set.completed ? NativeWorkoutPalette.green : Color.white.opacity(0.1)))
                }
                .accessibilityLabel(set.completed ? "Mark set \(set.setNumber) incomplete" : "Complete set \(set.setNumber)")
            }
            TextField(
                "",
                text: Binding(get: { set.notes }, set: onNotesChanged),
                prompt: Text("Add a note (optional)").foregroundColor(.white.opacity(0.24))
            )
                .font(.subheadline)
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .frame(height: 42)
                .background(Color.black.opacity(0.2), in: RoundedRectangle(cornerRadius: 11))
                .accessibilityLabel("Set \(set.setNumber) note")
        }
        .padding(12)
        .background(set.completed ? NativeWorkoutPalette.green.opacity(0.07) : NativeWorkoutPalette.card, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(set.completed ? NativeWorkoutPalette.green.opacity(0.34) : Color.white.opacity(0.07)))
    }
}

private struct NativeWorkoutField: View {
    let label: String
    let value: String
    let placeholder: String
    let keyboard: UIKeyboardType
    let suffix: String?
    let onChange: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .tracking(0.8)
                .foregroundColor(.white.opacity(0.38))
            HStack(spacing: 3) {
                TextField(
                    "",
                    text: Binding(get: { value }, set: onChange),
                    prompt: Text(placeholder).foregroundColor(.white.opacity(0.24))
                )
                    .keyboardType(keyboard)
                    .font(.body.weight(.bold))
                    .foregroundColor(.white)
                    .minimumScaleFactor(0.75)
                if let suffix {
                    Text(suffix)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.white.opacity(0.3))
                }
            }
            .padding(.horizontal, 10)
            .frame(height: 48)
            .background(Color.black.opacity(0.24), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.09)))
        }
        .frame(maxWidth: .infinity)
    }
}

private struct NativeWorkoutElapsedTime: View {
    let startedAt: Date?

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            Label(elapsed(at: context.date), systemImage: "timer")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.white.opacity(0.65))
        }
    }

    private func elapsed(at date: Date) -> String {
        guard let startedAt else { return "0:00" }
        let total = max(0, Int(date.timeIntervalSince(startedAt)))
        let hours = total / 3_600
        let minutes = (total % 3_600) / 60
        let seconds = total % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, seconds)
            : String(format: "%d:%02d", minutes, seconds)
    }
}

private struct NativeWorkoutOverviewView: View {
    @ObservedObject var model: NativeWorkoutViewModel
    @Binding var isPresented: Bool

    var body: some View {
        ZStack {
            NativeWorkoutPalette.background.ignoresSafeArea()
            VStack(spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("YOUR WORKOUT")
                            .font(.system(size: 10, weight: .black))
                            .tracking(1.8)
                            .foregroundColor(NativeWorkoutPalette.pink)
                        Text("Session overview")
                            .font(.system(size: 28, weight: .black, design: .rounded))
                        Text("\(model.completedSetCount) of \(model.totalSetCount) sets complete · tap any exercise to jump there")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.4))
                    }
                    Spacer()
                    Button { isPresented = false } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .bold))
                            .frame(width: 44, height: 44)
                            .background(Color.white.opacity(0.07), in: Circle())
                    }
                    .accessibilityLabel("Close session overview")
                }
                .padding(16)

                ScrollView {
                    VStack(spacing: 9) {
                        ForEach(Array(model.launch.session.exercises.enumerated()), id: \.element.id) { index, exercise in
                            let exerciseSets = model.sets[exercise.id] ?? []
                            let completed = exerciseSets.filter(\.completed).count
                            let isCurrent = index == model.exerciseIndex
                            Button {
                                model.jump(to: index)
                                isPresented = false
                            } label: {
                                HStack(spacing: 12) {
                                    Text("\(index + 1)")
                                        .font(.subheadline.weight(.black))
                                        .frame(width: 42, height: 42)
                                        .background(isCurrent ? NativeWorkoutPalette.pink : Color.white.opacity(0.06), in: Circle())
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(exercise.name)
                                            .font(.subheadline.weight(.bold))
                                        Text("\(exercise.prescription) · \(completed)/\(exerciseSets.count) sets")
                                            .font(.caption)
                                            .foregroundColor(.white.opacity(0.38))
                                    }
                                    Spacer()
                                    if isCurrent {
                                        Text("CURRENT")
                                            .font(.system(size: 9, weight: .black))
                                            .tracking(1)
                                            .foregroundColor(NativeWorkoutPalette.pink)
                                    } else {
                                        Image(systemName: "chevron.right")
                                            .foregroundColor(.white.opacity(0.25))
                                    }
                                }
                                .padding(13)
                                .background(isCurrent ? NativeWorkoutPalette.pink.opacity(0.1) : NativeWorkoutPalette.card, in: RoundedRectangle(cornerRadius: 18))
                                .overlay(RoundedRectangle(cornerRadius: 18).stroke(isCurrent ? NativeWorkoutPalette.pink.opacity(0.5) : Color.white.opacity(0.06)))
                            }
                            .accessibilityLabel("\(exercise.name), exercise \(index + 1) of \(model.launch.session.exercises.count), \(completed) of \(exerciseSets.count) sets complete")
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

private enum NativeWorkoutPalette {
    static let background = Color(red: 0.035, green: 0.035, blue: 0.043)
    static let card = Color.white.opacity(0.045)
    static let pink = Color(red: 0.88, green: 0.25, blue: 0.82)
    static let green = Color(red: 0.34, green: 0.88, blue: 0.67)
}

#if DEBUG
private let nativeWorkoutPreviewLaunch = NativeWorkoutLaunch(
    schemaVersion: 1,
    session: NativeWorkoutSession(
        id: "preview-session",
        name: "Full Body Strength",
        notes: "Move with intent. Leave one clean rep in reserve.",
        exercises: [
            NativeWorkoutExercise(id: "squat", name: "Back Squat", prescription: "3 × 6", section: "Main strength", restSeconds: 90, notes: "Control the descent and drive through mid-foot.", demoURL: nil, usesSetLogging: true),
            NativeWorkoutExercise(id: "rdl", name: "Romanian Deadlift", prescription: "3 × 8", section: "Main strength", restSeconds: 90, notes: nil, demoURL: nil, usesSetLogging: true),
            NativeWorkoutExercise(id: "plank", name: "Side Plank", prescription: "30 sec each side", section: "Core finisher", restSeconds: 30, notes: nil, demoURL: nil, usesSetLogging: false),
        ]
    ),
    date: "2026-08-18",
    dateLabel: "Today",
    mode: "workout",
    sets: [
        "squat": (1...3).map { NativeWorkoutSet(setNumber: $0, weight: $0 == 1 ? "82.5" : "", reps: $0 == 1 ? "6" : "", notes: "", completed: $0 == 1) },
        "rdl": (1...3).map { NativeWorkoutSet(setNumber: $0, weight: "", reps: "", notes: "", completed: false) },
        "plank": [NativeWorkoutSet(setNumber: 1, weight: "", reps: "", notes: "", completed: false)],
    ],
    startedAt: nil
)

struct NativeWorkoutView_Previews: PreviewProvider {
    static var previews: some View {
        NativeWorkoutView(launch: nativeWorkoutPreviewLaunch, onClose: {}, onPending: { _ in })
            .previewDisplayName("Native workout")
    }
}
#endif
