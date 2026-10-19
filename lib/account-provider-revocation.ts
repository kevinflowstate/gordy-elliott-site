export type WearableConnection = {
  terra_user_id: string | null;
  raw_user: unknown;
};

export type CalendarConnection = {
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

