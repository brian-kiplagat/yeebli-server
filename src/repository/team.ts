import { and, desc, eq } from "drizzle-orm";
import {
  teamSchema,
  teamMemberSchema,
  teamInvitationSchema,
} from "../schema/schema.ts";
import { db } from "../lib/database.ts";


export class TeamRepository {
  public async createTeam(name: string, hostId: number) {
    const [team] = await db
      .insert(teamSchema)
      .values({
        name,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .$returningId();

    // Add host as team member
    await db.insert(teamMemberSchema).values({
      team_id: team.id,
      user_id: hostId,
      role: "host",
      created_at: new Date(),
      updated_at: new Date(),
    });

    return team;
  }

  public async getTeamById(id: number) {
    return await db.query.teamSchema.findFirst({
      where: (team, { eq }) => eq(team.id, id),
    });
  }

  public async getTeamMembers(teamId: number) {
    return await db.query.teamMemberSchema.findMany({
      where: (member, { eq }) => eq(member.team_id, teamId),
    });
  }

  public async getUserTeams(userId: number) {
    return await db.query.teamMemberSchema.findMany({
      where: (member, { eq }) => eq(member.user_id, userId),
    });
  }

  public async isTeamHost(teamId: number, userId: number) {
    const member = await db.query.teamMemberSchema.findFirst({
      where: (member, { and, eq }) =>
        and(
          eq(member.team_id, teamId),
          eq(member.user_id, userId),
          eq(member.role, "host")
        ),
    });
    return !!member;
  }

  public async addTeamMember(
    teamId: number,
    userId: number,
    role: "host" | "member" = "member"
  ) {
    const [member] = await db
      .insert(teamMemberSchema)
      .values({
        team_id: teamId,
        user_id: userId,
        role,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .$returningId();
    return member;
  }

  public async createInvitation(
    teamId: number,
    inviterId: number,
    inviteeEmail: string
  ) {
    const [invitation] = await db
      .insert(teamInvitationSchema)
      .values({
        team_id: teamId,
        inviter_id: inviterId,
        invitee_email: inviteeEmail,
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .$returningId();

    return invitation.id;
  }

  public async getInvitation(id: number) {
    return await db.query.teamInvitationSchema.findFirst({
      where: (invitation, { eq }) => eq(invitation.id, id),
    });
  }

  public async getInvitationsByTeam(teamId: number) {
    return await db.query.teamInvitationSchema.findMany({
      where: (invitation, { eq }) => eq(invitation.team_id, teamId),
      orderBy: (invitation, { desc }) => desc(invitation.created_at),
    });
  }

  public async getInvitationsByEmail(email: string) {
    return await db.query.teamInvitationSchema.findMany({
      where: (invitation, { eq }) => eq(invitation.invitee_email, email),
      orderBy: (invitation, { desc }) => desc(invitation.created_at),
    });
  }

  public async updateInvitationStatus(
    id: number,
    status: "pending" | "accepted" | "rejected"
  ) {
    await db
      .update(teamInvitationSchema)
      .set({ status, updated_at: new Date() })
      .where(eq(teamInvitationSchema.id, id));
  }
}
