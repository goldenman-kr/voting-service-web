import { describe, expect, it, vi } from "vitest";

import { Role } from "../../src/guardrails/index.js";
import { createMockAdminSession } from "../../src/server/auth/admin-session";
import type { PrismaClientLike } from "../../src/server/db/prisma";
import { getAdminElectionDashboard } from "../../src/server/elections/admin-election-view";

describe("admin election dashboard", () => {
  it("counts organization-managed registries instead of election registry copies", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const managedRegistryCount = vi.fn().mockResolvedValue(2);
    const prisma = {
      election: { findMany },
      managedVoterRegistry: { count: managedRegistryCount },
      voterRegistry: {
        count: vi.fn(() => {
          throw new Error("dashboard must not count election registry copies");
        })
      }
    } as unknown as PrismaClientLike;
    const session = createMockAdminSession({ roles: [Role.ELECTION_MANAGER] });

    const dashboard = await getAdminElectionDashboard(prisma, session);

    expect(managedRegistryCount).toHaveBeenCalledWith({
      where: { organizationId: session.organizationId }
    });
    expect(dashboard.registryCount).toBe(2);
  });
});
