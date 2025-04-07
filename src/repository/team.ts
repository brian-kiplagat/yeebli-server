import { and, desc, eq } from "drizzle-orm";
import { db } from "../lib/database.ts";
import { teamInvitationSchema, teamSchema } from "../schema/schema.ts";
import type { TeamInvitation } from "../schema/schema.ts";

export class TeamRepository {
  async createInvitation(invitation: {
    team_id: number;
    inviter_id: number;
    invitee_email: string;
  }) {
    const result = await db
      .insert(teamInvitationSchema)
      .values(invitation)
      .$returningId();
    return result[0].id;
  }

  async getInvitation(id: number) {
    const result = await db
      .select()
      .from(teamInvitationSchema)
      .where(eq(teamInvitationSchema.id, id))
      .limit(1);
    return result[0];
  }

  async getInvitationsByTeam(teamId: number) {
    return await db
      .select()
      .from(teamInvitationSchema)
      .where(eq(teamInvitationSchema.team_id, teamId))
      .orderBy(desc(teamInvitationSchema.created_at));
  }

  async getInvitationsByEmail(email: string) {
    return await db
      .select()
      .from(teamInvitationSchema)
      .where(eq(teamInvitationSchema.invitee_email, email))
      .orderBy(desc(teamInvitationSchema.created_at));
  }

  async updateInvitationStatus(
    id: number,
    status: "pending" | "accepted" | "rejected"
  ) {
    await db
      .update(teamInvitationSchema)
      .set({ status })
      .where(eq(teamInvitationSchema.id, id));
  }

  async getTeamById(id: number) {
    const result = await db
      .select()
      .from(teamSchema)
      .where(eq(teamSchema.id, id))
      .limit(1);
    return result[0];
  }
}
