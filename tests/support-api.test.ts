import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import sharp from "sharp";
import { PGlite } from "@electric-sql/pglite";
import { POST } from "../app/api/support/reports/route";
import { listSupportQueuePage } from "../lib/support-queue-server";
import { createAdminClient } from "../lib/supabase/admin";
const input = {
  submission_key: "5a82969a-4a6d-4311-b4f8-7b90ab820c11",
  name: "Taylor Example",
  email: "taylor@example.invalid",
  area: "Training",
  description: "Workout completion is missing",
  expected: "",
  impact: "Something looks wrong",
  device: "iPhone",
  page: "/portal/exercise-plan",
};
function request(
  values: Record<string, string> = input,
  file?: File,
  origin = "http://127.0.0.1:3147",
) {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.append(key, value);
  if (file) body.append("screenshot", file);
  // Next dev can use localhost in request.url even with a 127.0.0.1 Host/Origin.
  return new Request("http://localhost:3147/api/support/reports", {
    method: "POST",
    headers: { host: "127.0.0.1:3147", origin, "x-forwarded-for": "192.0.2.1" },
    body,
  });
}
test("HTTP intake rejects cross-site/malformed requests before database access", async () => {
  assert.equal(
    (await POST(request(input, undefined, "https://outside.example"))).status,
    403,
  );
  assert.equal(
    (await POST(request(input, undefined, "not a URL"))).status,
    403,
  );
  assert.equal((await POST(request({ ...input, email: "bad" }))).status, 400);
  assert.equal(
    (await POST(request({ ...input, website: "spam" }))).status,
    400,
  );
  const huge = request();
  huge.headers.set("content-length", String(4 * 1024 * 1024));
  assert.equal((await POST(huge)).status, 413);
  const chunked = new Request("http://localhost:3147/api/support/reports", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3147",
      origin: "http://127.0.0.1:3147",
      "content-type": "multipart/form-data; boundary=test",
    },
    body: "x".repeat(3 * 1024 * 1024 + 1),
  });
  assert.equal((await POST(chunked)).status, 413);
});
test("actual submission handler persists to migrated Postgres and returns only a receipt", async () => {
  const db = new PGlite();
  let failUpload = false;
  let failLink = false;
  let failRpc = false;
  const uploads: Buffer[] = [];
  let deletedUploads = 0;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;",
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261005093000_support_reports.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.headers.authorization !== "Bearer local-support-test-key") {
      res.statusCode = 401;
      res.end("{}");
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    try {
      const url = new URL(req.url!, "http://localhost");
      if (url.pathname === "/rest/v1/rpc/reserve_support_request") {
        const args = JSON.parse(body.toString());
        try {
          await db.query("select reserve_support_request($1)", [
            args.p_reporter_hash,
          ]);
          res.end("null");
        } catch (error) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              message: error instanceof Error ? error.message : "error",
            }),
          );
        }
      } else if (url.pathname === "/rest/v1/rpc/submit_support_report") {
        if (failRpc) {
          res.statusCode = 503;
          res.end(JSON.stringify({ message: "local unavailable" }));
          return;
        }
        const args = JSON.parse(body.toString());
        try {
          const rows = await db.query<{ receipt: unknown }>(
            "select submit_support_report($1::jsonb,$2) receipt",
            [JSON.stringify(args.p_input), args.p_reporter_hash],
          );
          res.end(JSON.stringify(rows.rows[0].receipt));
        } catch (error) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              message: error instanceof Error ? error.message : "error",
            }),
          );
        }
      } else if (
        url.pathname.startsWith("/storage/v1/object/support-images") &&
        req.method === "POST"
      ) {
        if (failUpload) {
          res.statusCode = 503;
          res.end(JSON.stringify({ message: "upload failed" }));
        } else {
          uploads.push(body);
          res.end(JSON.stringify({ Key: url.pathname }));
        }
      } else if (
        url.pathname.startsWith("/storage/v1/object/support-images") &&
        req.method === "DELETE"
      ) {
        deletedUploads++;
        res.end("[]");
      } else if (
        url.pathname === "/rest/v1/support_reports" &&
        req.method === "PATCH"
      ) {
        if (failLink) {
          res.statusCode = 503;
          res.end(JSON.stringify({ message: "link failed" }));
          return;
        }
        const id = url.searchParams.get("id")?.replace("eq.", "");
        const update = JSON.parse(body.toString());
        await db.query("update support_reports set image_path=$1 where id=$2", [
          update.image_path,
          id,
        ]);
        res.end("[]");
      } else if (
        url.pathname === "/rest/v1/support_reports" &&
        req.method === "GET"
      ) {
        const id = url.searchParams.get("id")?.replace("eq.", "");
        if (id) {
          const rows = await db.query(
            "select image_path from support_reports where id=$1",
            [id],
          );
          res.end(JSON.stringify(rows.rows[0]));
        } else {
          const status = url.searchParams.get("status");
          const filter =
            status === "not.in.(Resolved,Duplicate)"
              ? "where status not in ('Resolved','Duplicate')"
              : status?.startsWith("eq.")
                ? "where status=$1"
                : "";
          const args = status?.startsWith("eq.") ? [status.slice(3)] : [];
          const offset = Number(url.searchParams.get("offset") || 0),
            limit = Number(url.searchParams.get("limit") || 50);
          const count = (
            await db.query<{ count: number }>(
              `select count(*)::int count from support_reports ${filter}`,
              args,
            )
          ).rows[0].count;
          const rows = await db.query(
            `select * from support_reports ${filter} order by created_at desc,id desc offset ${offset} limit ${limit}`,
            args,
          );
          res.setHeader(
            "Content-Range",
            `${offset}-${offset + rows.rows.length - 1}/${count}`,
          );
          res.end(JSON.stringify(rows.rows));
        }
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: "unknown test endpoint" }));
      }
    } catch {
      res.statusCode = 500;
      res.end(JSON.stringify({ message: "test server failure" }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-support-test-key";
  try {
    assert.equal(
      (
        await POST(
          request(
            input,
            new File(["not image data"], "false.png", { type: "image/png" }),
          ),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await POST(
          request(
            input,
            new File(
              [
                '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>',
              ],
              "disguised.png",
              { type: "image/png" },
            ),
          ),
        )
      ).status,
      400,
    );
    const jpeg = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#e040d0" },
    })
      .png()
      .toBuffer();
    const file = new File([jpeg], "example.png", { type: "image/png" });
    const response = await POST(request(input, file));
    assert.equal(response.status, 200);
    const receipt = await response.json();
    assert.deepEqual(Object.keys(receipt).sort(), [
      "attachmentSaved",
      "reference",
    ]);
    assert.equal(receipt.attachmentSaved, true);
    assert.equal(uploads.length, 1);
    assert.equal((await sharp(uploads[0]).metadata()).format, "jpeg");
    const first = (
      await db.query<{
        email: string;
        image_path: string;
        reporter_hash: string;
      }>("select email,image_path,reporter_hash from support_reports")
    ).rows[0];
    assert.equal(first.email, input.email);
    assert.ok(first.image_path);
    assert.equal(first.reporter_hash.length, 64);
    assert.ok(!first.reporter_hash.includes("192.0.2"));
    const duplicate = await (await POST(request(input, file))).json();
    assert.equal(duplicate.reference, receipt.reference);
    assert.equal(uploads.length, 1);
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int count from support_reports",
        )
      ).rows[0].count,
      1,
    );
    failUpload = true;
    const failedUpload = await (
      await POST(
        request({ ...input, submission_key: crypto.randomUUID() }, file),
      )
    ).json();
    assert.equal(failedUpload.attachmentSaved, false);
    assert.ok(failedUpload.reference, "written report survives upload failure");
    failUpload = false;
    failLink = true;
    const failedLink = await (
      await POST(
        request({ ...input, submission_key: crypto.randomUUID() }, file),
      )
    ).json();
    assert.equal(failedLink.attachmentSaved, false);
    assert.equal(
      deletedUploads,
      1,
      "orphaned upload removed after link failure",
    );
    failLink = false;
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await POST(request({ ...input, submission_key: crypto.randomUUID() })))
          .status,
        200,
      );
    assert.equal(
      (await POST(request({ ...input, submission_key: crypto.randomUUID() })))
        .status,
      429,
    );
    assert.equal(
      (await POST(request(input))).status,
      200,
      "duplicate receipt still available at quota",
    );
    await db.exec("update support_request_limits set requests=20");
    assert.equal(
      (
        await POST(
          request(
            input,
            new File(["not image data"], "false.png", { type: "image/png" }),
          ),
        )
      ).status,
      429,
      "admission rejects exhausted callers before attempting image decode",
    );
    await db.exec("update support_request_limits set requests=0");
    await db.exec(
      "insert into support_reports(submission_key,reference,name,email,area,description,impact,reporter_hash,status,created_at) select gen_random_uuid(),'CLOSED-'||i,'Fictional','closed@example.invalid','Training','Fictional closed report','Something looks wrong','fixture','Resolved',now()+interval '1 day' from generate_series(1,250)i",
    );
    const openPage = await listSupportQueuePage(createAdminClient(), "Open", 0);
    assert.equal(openPage.count, 5);
    assert.equal(
      openPage.data?.length,
      5,
      "old unresolved reports are reachable despite 250 newer resolved reports",
    );
    const firstPage = await listSupportQueuePage(createAdminClient(), "All", 0);
    const nextPage = await listSupportQueuePage(createAdminClient(), "All", 1);
    assert.equal(firstPage.count, 255);
    assert.equal(firstPage.data?.length, 50);
    assert.equal(nextPage.data?.length, 50);
    assert.equal(
      firstPage.data?.some((first) =>
        nextPage.data?.some((next) => next.id === first.id),
      ),
      false,
      "stable ordering avoids duplicates between pages",
    );
    await assert.rejects(() =>
      listSupportQueuePage(createAdminClient(), "unknown", 0),
    );
    failRpc = true;
    assert.equal(
      (await POST(request({ ...input, submission_key: crypto.randomUUID() })))
        .status,
      503,
    );
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    await db.close();
  }
});
