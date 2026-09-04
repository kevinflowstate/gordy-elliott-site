import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { COMMUNITY_MEDIA_BUCKET } from "@/lib/community-media";
import { NextResponse } from "next/server";

type AdminClient = ReturnType<typeof createAdminClient>;

type WearableConnection = {
  terra_user_id: string | null;
  raw_user: unknown;
};

type CalendarConnection = {
  composio_user_id: string;
  composio_connected_account_id: string | null;
};

type ProviderRevocationDependencies = {
  deauthenticateTerraUser: (terraUserId: string) => Promise<unknown>;
  deleteComposioConnectedAccount: (connectedAccountId: string) => Promise<unknown>;
  listComposioConnectedAccountIds: (composioUserId: string) => Promise<string[]>;
};

const providerRevocationDependencies: ProviderRevocationDependencies = {
  async deauthenticateTerraUser(terraUserId) {
    const { deauthenticateTerraUser } = await import("@/lib/terra/client");
    return deauthenticateTerraUser(terraUserId);
  },
  async deleteComposioConnectedAccount(connectedAccountId) {
    const { getComposioClient } = await import("@/lib/composio/client");
    return getComposioClient().connectedAccounts.delete(connectedAccountId);
  },
  async listComposioConnectedAccountIds(composioUserId) {
    const { getComposioClient } = await import("@/lib/composio/client");
    const remoteAccounts = await getComposioClient().connectedAccounts.list({
      userIds: [composioUserId],
      limit: 100,
    }, { signal: AbortSignal.timeout(10_000) });
    return remoteAccounts.items.map((account) => account.id);
  },
};

function isMockWearableConnection(connection: WearableConnection) {
  return Boolean(
    connection.raw_user
    && typeof connection.raw_user === "object"
    && "mock" in connection.raw_user
    && connection.raw_user.mock === true
  );
}

export async function revokeExternalProviderAccess(
  wearableConnections: WearableConnection[],
  calendarConnections: CalendarConnection[],
  dependencies: ProviderRevocationDependencies = providerRevocationDependencies,
) {
  const terraUserIds = [...new Set(wearableConnections
    .filter((connection) => connection.terra_user_id && !isMockWearableConnection(connection))
    .map((connection) => connection.terra_user_id as string))];

  for (const terraUserId of terraUserIds) {
    await dependencies.deauthenticateTerraUser(terraUserId);
  }

  const composioConnections = new Map<string, string>();
  for (const connection of calendarConnections) {
    if (connection.composio_connected_account_id) {
      composioConnections.set(connection.composio_connected_account_id, connection.composio_user_id);
    }
  }

  for (const [connectedAccountId, composioUserId] of composioConnections) {
    try {
      await dependencies.deleteComposioConnectedAccount(connectedAccountId);
    } catch (disconnectError) {
      const remainingIds = await dependencies.listComposioConnectedAccountIds(composioUserId);
      if (remainingIds.includes(connectedAccountId)) throw disconnectError;
    }
  }
}

async function listStoragePaths(admin: AdminClient, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;

    for (const item of data || []) {
      const itemPath = `${prefix}/${item.name}`;
      if (item.id) paths.push(itemPath);
      else paths.push(...await listStoragePaths(admin, bucket, itemPath));
    }

    if (!data || data.length < 1000) break;
    offset += data.length;
  }

  return paths;
}

async function removeStoragePaths(admin: AdminClient, bucket: string, paths: string[]) {
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100));
    if (error) throw error;
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (body?.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: account, error: accountError }, { data: profile, error: profileError }] = await Promise.all([
    admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle(),
    admin
      .from("client_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (accountError || profileError) return NextResponse.json({ error: "Unable to verify your account." }, { status: 500 });
  if (account?.role === "admin") {
    return NextResponse.json({ error: "Admin accounts cannot be deleted from the client portal." }, { status: 403 });
  }

  try {
    if (profile) {
      const [{ data: wearableConnections, error: wearableError }, { data: calendarConnections, error: calendarError }] = await Promise.all([
        admin
          .from("client_wearable_connections")
          .select("terra_user_id, raw_user")
          .eq("client_id", profile.id),
        admin
          .from("client_calendar_connections")
          .select("composio_user_id, composio_connected_account_id")
          .eq("client_id", profile.id),
      ]);
      if (wearableError || calendarError) throw new Error("Provider connections could not be loaded.");

      await revokeExternalProviderAccess(
        (wearableConnections || []) as WearableConnection[],
        (calendarConnections || []) as CalendarConnection[],
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Your connected apps could not be disconnected. Please try again." },
      { status: 502 },
    );
  }

  try {
    const avatarPaths = await listStoragePaths(admin, "avatars", user.id);
    await removeStoragePaths(admin, "avatars", avatarPaths);

    if (profile) {
      const [
        { data: documents, error: documentsError },
        progressPaths,
        inboxAudioPaths,
        inboxImagePaths,
        communityMediaPaths,
      ] = await Promise.all([
        admin
          .from("client_documents")
          .select("storage_bucket, storage_path")
          .eq("client_id", profile.id),
        listStoragePaths(admin, "progress-photos", profile.id),
        listStoragePaths(admin, "inbox-audio", profile.id),
        listStoragePaths(admin, "inbox-images", profile.id),
        listStoragePaths(admin, COMMUNITY_MEDIA_BUCKET, user.id),
      ]);
      if (documentsError) throw documentsError;

      const documentsByBucket = new Map<string, string[]>();
      for (const document of documents || []) {
        documentsByBucket.set(document.storage_bucket, [
          ...(documentsByBucket.get(document.storage_bucket) || []),
          document.storage_path,
        ]);
      }
      await Promise.all([
        removeStoragePaths(admin, "progress-photos", progressPaths),
        removeStoragePaths(admin, "inbox-audio", inboxAudioPaths),
        removeStoragePaths(admin, "inbox-images", inboxImagePaths),
        removeStoragePaths(admin, COMMUNITY_MEDIA_BUCKET, communityMediaPaths),
        ...Array.from(documentsByBucket, ([bucket, paths]) => removeStoragePaths(admin, bucket, paths)),
      ]);
    }
  } catch {
    return NextResponse.json({ error: "Your uploaded files could not be removed. Please try again." }, { status: 500 });
  }

  // Deleting the auth user cascades through the client-owned database records.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Your account could not be deleted. Please try again." }, { status: 500 });

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
