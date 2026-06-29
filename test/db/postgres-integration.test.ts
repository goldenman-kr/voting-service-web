import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg(databaseUrl!)
  });
}

describeDb("PostgreSQL integration guardrails", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createPrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to PostgreSQL and verifies RBAC seed data", async () => {
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeTruthy();

    const [permissionCount, roleCount, rolePermissionCount] = await Promise.all([
      prisma.permission.count(),
      prisma.role.count({ where: { isSystemRole: true } }),
      prisma.rolePermission.count()
    ]);

    expect(permissionCount).toBeGreaterThan(0);
    expect(roleCount).toBeGreaterThan(0);
    expect(rolePermissionCount).toBeGreaterThan(0);
  });

  it("creates core records and enforces one current ballot per anonymous group", async () => {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: `db-test-tenant-${suffix}`
      }
    });
    const organization = await prisma.organization.create({
      data: {
        tenantId: tenant.id,
        name: `db-test-org-${suffix}`
      }
    });
    const election = await prisma.election.create({
      data: {
        organizationId: organization.id,
        title: `DB Test Election ${suffix}`,
        electionType: "representative_election",
        votingMode: "anonymous",
        state: "draft",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-01-01T01:00:00.000Z"),
        timezone: "Asia/Seoul"
      }
    });

    try {
      const authenticationPolicy = await prisma.authenticationPolicy.create({
        data: {
          electionId: election.id
        }
      });
      expect(authenticationPolicy.method).toBe("invite_link_with_identifier");

      const group = await prisma.anonymousBallotGroup.create({
        data: {
          electionId: election.id,
          ballotGroupTokenHash: `hash-${suffix}`
        }
      });
      const firstBallot = await prisma.ballot.create({
        data: {
          electionId: election.id,
          anonymousBallotGroupId: group.id,
          submissionStatus: "received",
          acceptanceStatus: "accepted",
          serverReceivedAt: new Date("2026-01-01T00:10:00.000Z"),
          isCurrent: true,
          receiptHash: `receipt-${suffix}-1`
        }
      });
      await expect(
        prisma.ballot.create({
          data: {
            electionId: election.id,
            anonymousBallotGroupId: group.id,
            submissionStatus: "received",
            acceptanceStatus: "accepted",
            serverReceivedAt: new Date("2026-01-01T00:20:00.000Z"),
            isCurrent: true,
            receiptHash: `receipt-${suffix}-2`
          }
        })
      ).rejects.toThrow();

      await prisma.question.create({
        data: {
          electionId: election.id,
          title: "Question",
          questionType: "single_choice",
          required: true,
          displayOrder: 1
        }
      });

      const result = await prisma.result.create({
        data: {
          electionId: election.id,
          status: "tallied",
          talliedAt: new Date("2026-01-01T01:05:00.000Z"),
          sourceRule: "current_accepted_before_close"
        }
      });
      const version = await prisma.resultVersion.create({
        data: {
          electionId: election.id,
          resultId: result.id,
          versionNo: 1,
          versionType: "initial",
          status: "confirmed"
        }
      });

      expect(firstBallot.isCurrent).toBe(true);
      expect(version.versionNo).toBe(1);
    } finally {
      await prisma.anonymousBallotGroup.updateMany({
        where: { electionId: election.id },
        data: { currentBallotId: null }
      });
      await prisma.resultVersion.deleteMany({ where: { electionId: election.id } });
      await prisma.result.deleteMany({ where: { electionId: election.id } });
      await prisma.voteOption.deleteMany({
        where: { vote: { ballot: { electionId: election.id } } }
      });
      await prisma.vote.deleteMany({ where: { ballot: { electionId: election.id } } });
      await prisma.submissionEvent.deleteMany({ where: { electionId: election.id } });
      await prisma.ballot.deleteMany({ where: { electionId: election.id } });
      await prisma.anonymousBallotGroup.deleteMany({ where: { electionId: election.id } });
      await prisma.question.deleteMany({ where: { electionId: election.id } });
      await prisma.authenticationPolicy.deleteMany({ where: { electionId: election.id } });
      await prisma.election.delete({ where: { id: election.id } });
      await prisma.organization.delete({ where: { id: organization.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("keeps forbidden anonymous voting columns out of database tables", async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'ballots',
          'votes',
          'anonymous_ballot_groups',
          'submission_events',
          'credential_events',
          'voter_sessions'
        )
    `;
    const columnsByTable = new Map<string, Set<string>>();
    for (const row of rows) {
      const columns = columnsByTable.get(row.table_name) ?? new Set<string>();
      columns.add(row.column_name);
      columnsByTable.set(row.table_name, columns);
    }

    const forbiddenColumnsByTable = {
      ballots: ["eligible_voter_id", "voting_credential_id", "user_id", "voter_session_id"],
      votes: ["eligible_voter_id", "voting_credential_id", "user_id", "voter_session_id"],
      anonymous_ballot_groups: ["eligible_voter_id", "voting_credential_id", "voter_session_id"],
      submission_events: ["eligible_voter_id", "voting_credential_id", "voter_session_id"],
      credential_events: ["ballot_id", "anonymous_ballot_group_id", "submission_event_id"],
      voter_sessions: ["ballot_id", "vote_id", "anonymous_ballot_group_id", "submission_event_id"]
    };

    for (const [tableName, forbiddenColumns] of Object.entries(forbiddenColumnsByTable)) {
      const columns = columnsByTable.get(tableName);
      expect(columns, tableName).toBeTruthy();
      for (const column of forbiddenColumns) {
        expect(columns?.has(column), `${tableName}.${column}`).toBe(false);
      }
    }
  });
});
