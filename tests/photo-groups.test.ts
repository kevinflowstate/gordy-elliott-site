import assert from "node:assert/strict";
import test from "node:test";
import { getProgressPhotoDateFolders } from "../lib/photo-groups";

test("progress photo folders are discovered without storage object ids", () => {
  const folders = getProgressPhotoDateFolders([
    { name: "2026-07-21" },
    { name: "2026-07-14" },
    { name: ".emptyFolderPlaceholder" },
    { name: "front.jpg" },
  ]);

  assert.deepEqual(folders, ["2026-07-21", "2026-07-14"]);
});
