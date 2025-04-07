import { logger } from "../lib/logger.ts";
import type { TeamRepository } from "../repository/team.ts";
import type { UserService } from "./user.ts";
import { sendTransactionalEmail } from "../task/sendWelcomeEmail.ts";
import type { TeamMember, User } from "../schema/schema.ts";
import { generateSecurePassword } from "../util/string.ts";

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
      logger.error(error);
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

      const acceptUrl = `https://yeebli-e10656.webflow.io/onboarding/accept-team-invitation?code=${invitationId}&token=${teamId}&action=${teamName}`;

      // Send invitation email
      await sendTransactionalEmail(inviteeEmail, "Team Invitation", 1, {
        subject: "Team Invitation",
        title: "You've been invited to join a team",
        subtitle: "Join the team to collaborate",
        body: `You've been invited to join the "${teamName}" team. Click the link below to accept the invitation. ${acceptUrl}`,
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
        const tempPassword = generateSecurePassword(9);
        const newUserID = await this.userService.create(
          invitation.invitee_email.split("@")[0], // Use email prefix as name
          invitation.invitee_email,
          tempPassword, // User will need to reset this
          "host",
          "",
          { is_verified: true, subscription_status: "active" }
        );
        user = await this.userService.findByEmail(invitation.invitee_email) ?? null;
        if (!user) {
          throw new Error("Failed to create or find user");
        }
        //send transactional email
        sendTransactionalEmail(user.email, "Temporary Password", 1, {
          subject: "New account created",
          title: "Welcome to Yeebli",
          subtitle: "Change your password",
          body: `A new account was created with your email ${user.email}. We also created a random temporary password for you. Please change your password immediately after logging in. Your temporary password is ${tempPassword}`,
        });
      }

      if (!user) {
        throw new Error("Failed to create or find user");
      }

      // Add user to team
      await this.repo.addTeamMember(invitation.team_id, user.id);

      // Update invitation status
      await this.repo.updateInvitationStatus(invitationId, "accepted");
      // Send welcome email
      await sendTransactionalEmail(user.email, "Welcome to the team", 1, {
        subject: "You're officially on the team!",
        title: "Welcome aboard 🎉",
        subtitle: "Team invite accepted",
        body: "You've successfully joined the team. Start collaborating and making things happen with your teammates!",
      });

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
