import { logger } from "../lib/logger.ts";
import type { TeamRepository } from "../repository/team.ts";
import type { UserService } from "./user.ts";
import { sendTransactionalEmail } from "../task/sendWelcomeEmail.ts";
import type { TeamMember, User } from "../schema/schema.ts";

export class TeamService {
  public repo: TeamRepository;
  public userService: UserService;

  constructor(repo: TeamRepository, userService: UserService) {
    this.repo = repo;
    this.userService = userService;
  }

  public async createTeam(name: string, hostId: number) {
    try {
      const team = await this.repo.createTeam(name, hostId);
      return team;
    } catch (error) {
      logger.error("Error creating team:", error);
      throw error;
    }
  }

  public async inviteMember(
    teamId: number,
    inviterId: number,
    inviteeEmail: string,
    teamName: string
  ) {
    try {
      // Create invitation
      const invitationId = await this.repo.createInvitation(
        teamId,
        inviterId,
        inviteeEmail
      );

      // Send invitation email
      await sendTransactionalEmail(inviteeEmail, "Team Invitation", 1, {
        subject: "Team Invitation",
        title: "You've been invited to join a team",
        subtitle: "Join the team to collaborate",
        body: `You've been invited to join the "${teamName}" team. Click the link below to accept the invitation.`,
      });

      return invitationId;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async getTeamInvitations(teamId: number) {
    return await this.repo.getInvitationsByTeam(teamId);
  }

  public async getMyInvitations(email: string) {
    return await this.repo.getInvitationsByEmail(email);
  }

  public async acceptInvitation(invitationId: number) {
    try {
      const invitation = await this.repo.getInvitation(invitationId);
      if (!invitation) {
        throw new Error("Invitation not found");
      }

      // Find or create user
      let user: User | null =
        (await this.userService.findByEmail(invitation.invitee_email)) ?? null;
      if (!user) {
        // Create user with default password (they'll need to reset it)
        const newUsers = await this.userService.create(
          invitation.invitee_email.split("@")[0], // Use email prefix as name
          invitation.invitee_email,
          "temp_password", // User will need to reset this
          "user",
          "",
          { is_verified: false }
        );
        user = newUsers[0] as User;
      }

      if (!user) {
        throw new Error("Failed to create or find user");
      }

      // Add user to team
      await this.repo.addTeamMember(invitation.team_id, user.id);

      // Update invitation status
      await this.repo.updateInvitationStatus(invitationId, "accepted");

      return invitation;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async rejectInvitation(invitationId: number) {
    try {
      const invitation = await this.repo.getInvitation(invitationId);
      await this.repo.updateInvitationStatus(invitationId, "rejected");
      return invitation;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async getTeamByUserId(userId: number) {
    return await this.repo.getTeamByUserId(userId);
  }

  public async getTeamByHostId(userId: number) {
    return await this.repo.getTeamByHostId(userId);
  }
}
