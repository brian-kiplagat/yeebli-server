import { and, desc, eq, like } from 'drizzle-orm';

import { db } from '../lib/database.ts';
import {
  teamInvitationSchema,
  teamMemberSchema,
  teamSchema,
  userSchema,
} from '../schema/schema.ts';
import { TeamQuery } from '../web/validator/team.ts';

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
      role: 'host',
      created_at: new Date(),
      updated_at: new Date(),
    });

    return team;
  }

  public async getTeamById(id: number) {
    return await db.query.teamSchema.findFirst({
      where: (team, { eq }) => eq(team.id, id),
      with: {
        members: true,
      },
    });
  }

  public async getTeamMembers(teamId: number, query?: TeamQuery) {
    const { page = 1, limit = 10, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = [eq(teamMemberSchema.team_id, teamId)];
    if (search) {
      whereConditions.push(like(teamSchema.name, `%${search}%`));
    }

    const members = await db
      .select({
        id: teamMemberSchema.id,
        team_id: teamMemberSchema.team_id,
        user_id: teamMemberSchema.user_id,
        role: teamMemberSchema.role,
        created_at: teamMemberSchema.created_at,
        updated_at: teamMemberSchema.updated_at,
        user: {
          id: userSchema.id,
          name: userSchema.name,
          email: userSchema.email,
          phone: userSchema.phone,
          role: userSchema.role,
        },
        team: {
          id: teamSchema.id,
          name: teamSchema.name,
        },
      })
      .from(teamMemberSchema)
      .leftJoin(teamSchema, eq(teamMemberSchema.team_id, teamSchema.id))
      .leftJoin(userSchema, eq(teamMemberSchema.user_id, userSchema.id))
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: teamMemberSchema.id })
      .from(teamMemberSchema)
      .leftJoin(teamSchema, eq(teamMemberSchema.team_id, teamSchema.id))
      .where(and(...whereConditions));

    return { members, total: total.length };
  }

  public async getUserTeams(userId: number) {
    return await db.query.teamMemberSchema.findMany({
      where: (member, { eq }) => eq(member.user_id, userId),
    });
  }

  public async isTeamHost(teamId: number, userId: number) {
    const member = await db.query.teamMemberSchema.findFirst({
      where: (member, { and, eq }) =>
        and(eq(member.team_id, teamId), eq(member.user_id, userId), eq(member.role, 'host')),
    });
    return !!member;
  }

  public async isTeamMember(teamId: number, userId: number) {
    const member = await db.query.teamMemberSchema.findFirst({
      where: (member, { and, eq }) => and(eq(member.team_id, teamId), eq(member.user_id, userId)),
    });
    return !!member;
  }
  public async addTeamMember(teamId: number, userId: number, role: 'host' | 'member' = 'member') {
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

  public async createInvitation(teamId: number, inviterId: number, inviteeEmail: string) {
    const [invitation] = await db
      .insert(teamInvitationSchema)
      .values({
        team_id: teamId,
        inviter_id: inviterId,
        invitee_email: inviteeEmail,
        status: 'pending',
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

  public async getInvitationsByEmail(email: string, status?: 'pending' | 'accepted' | 'rejected') {
    return await db.query.teamInvitationSchema.findMany({
      where: (invitation, { eq, and }) => {
        const conditions = [eq(invitation.invitee_email, email)];
        if (status) {
          conditions.push(eq(invitation.status, status));
        }
        return and(...conditions);
      },
      orderBy: (invitation, { desc }) => desc(invitation.created_at),
      with: {
        team: true,
        inviter: {
          columns: {
            name: true,
            email: true,
          },
        },
      },
    });
  }

  public async updateInvitationStatus(id: number, status: 'pending' | 'accepted' | 'rejected') {
    await db
      .update(teamInvitationSchema)
      .set({ status, updated_at: new Date() })
      .where(eq(teamInvitationSchema.id, id));
  }

  public async getTeamByUserId(userId: number) {
    return await db.query.teamMemberSchema.findMany({
      where: eq(teamMemberSchema.user_id, userId),
      with: {
        team: true,
      },
    });
  }

  public async getTeamByHostId(userId: number) {
    return await db.query.teamMemberSchema.findFirst({
      where: and(eq(teamMemberSchema.user_id, userId), eq(teamMemberSchema.role, 'host')),
      with: {
        team: true,
        user: true,
      },
    });
  }

  public async removeTeamMember(teamId: number, userId: number) {
    await db.delete(teamMemberSchema).where(
      and(
        eq(teamMemberSchema.team_id, teamId),
        eq(teamMemberSchema.user_id, userId),
        eq(teamMemberSchema.role, 'member'), // Only allow removing members, not hosts
      ),
    );
  }

  public async deleteInvitation(id: number) {
    await db.delete(teamInvitationSchema).where(eq(teamInvitationSchema.id, id));
  }
}
