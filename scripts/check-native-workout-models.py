#!/usr/bin/env python3
"""Compile the production Foundation workout models and run their regression checks."""
from pathlib import Path
import subprocess
import tempfile


root = Path(__file__).resolve().parents[1]
external_disk = Path("/Volumes/CodexDev")
with tempfile.TemporaryDirectory(
    prefix="native-workout-checks-",
    dir=external_disk if external_disk.is_dir() else None,
) as directory:
    binary = str(Path(directory) / "native-workout-models")
    subprocess.run(
        ["swiftc", "ios/App/App/NativeWorkoutModels.swift", "tests/native-workout-models.swift", "-o", binary],
        cwd=root,
        check=True,
    )
    subprocess.run([binary], check=True)
