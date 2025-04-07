import { logger } from "../lib/logger.ts";
import type { TeamRepository } from "../repository/team.ts";
import type { UserService } from "./user.ts";
import { sendTransactionalEmail } from "../task/sendWelcomeEmail.ts";

export class TeamService {
  private repository: TeamRepository;
  private userService: UserService;

  constructor(repository: TeamRepository, userService: UserService) {
    this.repository = repository;
    this.userService = userService;
  }

  async inviteMember(teamId: number, inviterId: number, inviteeEmail: string) {
    try {
      // Check if user already exists
      const existingUser = await this.userService.findByEmail(inviteeEmail);
      if (existingUser) {
        throw new Error("User already exists");
      }

      // Create invitation
      const invitationId = await this.repository.createInvitation({
        team_id: teamId,
        inviter_id: inviterId,
        invitee_email: inviteeEmail,
      });

      // Get team details
      const team = await this.repository.getTeamById(teamId);
      if (!team) {
        throw new Error("Team not found");
      }

      // Send invitation email
      await sendTransactionalEmail(inviteeEmail, "Team Invitation", 1, {
        subject: "Team Invitation",
        title: "You've been invited to join a team",
        subtitle: `Join ${team.name}`,
        body: `You've been invited to join the team ${team.name}. Click the button below to accept the invitation.`,
      });

      return invitationId;
    } catch (error) {
      logger.error("Failed to invite member:", error);
      throw error;
    }
  }

  async getTeamInvitations(teamId: number) {
    return await this.repository.getInvitationsByTeam(teamId);
  }

  async getMyInvitations(email: string) {
    return await this.repository.getInvitationsByEmail(email);
  }

  async acceptInvitation(invitationId: number) {
    const invitation = await this.repository.getInvitation(invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    await this.repository.updateInvitationStatus(invitationId, "accepted");
    return invitation;
  }

  async rejectInvitation(invitationId: number) {
    const invitation = await this.repository.getInvitation(invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    await this.repository.updateInvitationStatus(invitationId, "rejected");
    return invitation;
  }
}
