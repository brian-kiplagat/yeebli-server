import env from '../lib/env.ts';
import { logger } from '../lib/logger.ts';
import type { TeamRepository } from '../repository/team.ts';
import type { User } from '../schema/schema.ts';
import { sendTransactionalEmail } from '../task/sendWelcomeEmail.ts';
import { generateSecurePassword } from '../util/string.ts';
import type { TeamQuery } from '../web/validator/team.ts';
import type { UserService } from './user.ts';

/**
 * Service class for managing teams, including member invitations, access control, and team operations
 */
export class TeamService {
  public repo: TeamRepository;
  public userService: UserService;

  /**
   * Creates an instance of TeamService
   * @param {TeamRepository} repo - Repository for team operations
   * @param {UserService} userService - Service for user operations
   */
  constructor(repo: TeamRepository, userService: UserService) {
    this.repo = repo;
    this.userService = userService;
  }

  /**
   * Creates a new team
   * @param {string} name - Name of the team
   * @param {number} hostId - ID of the team host/owner
   * @returns {Promise<Object>} Created team
   * @throws {Error} When team creation fails
   */
  public async createTeam(name: string, hostId: number) {
    try {
      const team = await this.repo.createTeam(name, hostId);
      return team;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Invites a new member to a team
   * @param {number} teamId - ID of the team
   * @param {number} inviterId - ID of the user sending the invitation
   * @param {string} inviteeEmail - Email of the invited user
   * @param {string} teamName - Name of the team
   * @returns {Promise<number>} ID of the created invitation
   * @throws {Error} When invitation creation or email sending fails
   */
  public async inviteMember(
    teamId: number,
    inviterId: number,
    inviteeEmail: string,
    teamName: string,
  ) {
    try {
      // Create invitation
      const invitationId = await this.repo.createInvitation(teamId, inviterId, inviteeEmail);

      const acceptUrl = `${env.FRONTEND_URL}/onboarding/accept-team-invitation?code=${invitationId}&token=${teamId}&action=${teamName}`;

      // Send invitation email
      await sendTransactionalEmail(inviteeEmail, 'Team Invitation', 1, {
        subject: 'Team Invitation',
        title: "You've been invited to join a team",
        subtitle: 'Join the team to collaborate',
        body: `You've been invited to join the "${teamName}" team. Click the link below to accept the invitation. ${acceptUrl}`,
        buttonText: 'Accept invitation',
        buttonLink: acceptUrl,
      });

      return invitationId;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves all invitations for a team
   * @param {number} teamId - ID of the team
   * @returns {Promise<Array>} List of team invitations
   */
  public async getTeamInvitations(teamId: number) {
    return await this.repo.getInvitationsByTeam(teamId);
  }

  /**
   * Retrieves invitations for a specific email address
   * @param {string} email - Email address to check
   * @param {'pending'|'accepted'|'rejected'} [status] - Optional invitation status filter
   * @returns {Promise<Array>} List of invitations
   */
  public async getMyInvitations(email: string, status?: 'pending' | 'accepted' | 'rejected') {
    return await this.repo.getInvitationsByEmail(email, status);
  }

  /**
   * Accepts a team invitation
   * @param {number} invitationId - ID of the invitation
   * @returns {Promise<Object>} The accepted invitation
   * @throws {Error} When invitation acceptance fails
   */
  public async acceptInvitation(invitationId: number) {
    try {
      const invitation = await this.repo.getInvitation(invitationId);
      if (!invitation) {
        throw new Error('Invitation not found');
      }

      // Find or create user
      let user: User | null =
        (await this.userService.findByEmail(invitation.invitee_email)) ?? null;
      if (!user) {
        // Create user with default password (they'll need to reset it)
        const tempPassword = generateSecurePassword(9);
        await this.userService.create(
          invitation.invitee_email.split('@')[0], // Use email prefix as name
          invitation.invitee_email,
          tempPassword, // User will need to reset this
          'host',
          '',
          { is_verified: true, subscription_status: 'active' },
        );
        user = (await this.userService.findByEmail(invitation.invitee_email)) ?? null;
        if (!user) {
          throw new Error('Failed to create or find user');
        }
        //send transactional email
        sendTransactionalEmail(user.email, 'Temporary Password', 1, {
          subject: 'New account created',
          title: 'Welcome to Yeebli',
          subtitle: 'Change your password',
          body: `A new account was created with your email ${user.email}. We also created a random temporary password for you. Please change your password immediately after logging in. Your temporary password is ${tempPassword}`,
          buttonText: 'Ok, got it',
          buttonLink: `${env.FRONTEND_URL}`,
        });
      }

      if (!user) {
        throw new Error('Failed to create or find user');
      }

      // Add user to team
      await this.repo.addTeamMember(invitation.team_id, user.id);

      // Update invitation status
      await this.repo.updateInvitationStatus(invitationId, 'accepted');
      // Send welcome email
      await sendTransactionalEmail(user.email, 'Welcome to the team', 1, {
        subject: "You're officially on the team!",
        title: 'Welcome aboard 🎉',
        subtitle: 'Team invite accepted',
        body: "You've successfully joined the team. Start collaborating and making things happen with your teammates!",
        buttonText: 'Ok, got it',
        buttonLink: `${env.FRONTEND_URL}`,
      });

      return invitation;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Rejects a team invitation
   * @param {number} invitationId - ID of the invitation
   * @returns {Promise<Object>} The rejected invitation
   * @throws {Error} When invitation rejection fails
   */
  public async rejectInvitation(invitationId: number) {
    try {
      const invitation = await this.repo.getInvitation(invitationId);
      await this.repo.updateInvitationStatus(invitationId, 'rejected');
      return invitation;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves a team by user ID
   * @param {number} userId - ID of the user
   * @returns {Promise<Object>} The team
   */
  public async getTeamByUserId(userId: number) {
    return await this.repo.getTeamByUserId(userId);
  }

  /**
   * Retrieves a team by host ID
   * @param {number} userId - ID of the host
   * @returns {Promise<Object>} The team
   */
  public async getTeamByHostId(userId: number) {
    return await this.repo.getTeamByHostId(userId);
  }

  /**
   * Retrieves an invitation by ID
   * @param {number} invitationId - ID of the invitation
   * @returns {Promise<Object>} The invitation
   */
  public async getInvitation(invitationId: number) {
    return await this.repo.getInvitation(invitationId);
  }

  /**
   * Revokes a user's access to a team
   * @param {number} teamId - ID of the team
   * @param {number} userId - ID of the user
   * @returns {Promise<{success: boolean}>} Success status
   * @throws {Error} When access revocation fails
   */
  public async revokeAccess(teamId: number, userId: number) {
    try {
      // Remove the team member
      await this.repo.removeTeamMember(teamId, userId);
      return { success: true };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves team members with optional filtering
   * @param {number} teamId - ID of the team
   * @param {TeamQuery} [query] - Query parameters for filtering members
   * @returns {Promise<Array>} List of team members
   * @throws {Error} When member retrieval fails
   */
  public async getTeamMembers(teamId: number, query?: TeamQuery) {
    try {
      return await this.repo.getTeamMembers(teamId, query);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves all teams a user is a member of
   * @param {number} userId - ID of the user
   * @returns {Promise<Array>} List of user's teams
   * @throws {Error} When team retrieval fails
   */
  public async getUserTeams(userId: number) {
    try {
      return await this.repo.getUserTeams(userId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves a team by its ID
   * @param {number} teamId - ID of the team
   * @returns {Promise<Object>} The team
   * @throws {Error} When team retrieval fails
   */
  public async getTeamById(teamId: number) {
    try {
      return await this.repo.getTeamById(teamId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Checks if a user is the host of a team
   * @param {number} teamId - ID of the team
   * @param {number} userId - ID of the user
   * @returns {Promise<boolean>} Whether the user is the team host
   * @throws {Error} When check fails
   */
  public async isTeamHost(teamId: number, userId: number) {
    try {
      return await this.repo.isTeamHost(teamId, userId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Checks if a user is a member of a team
   * @param {number} teamId - ID of the team
   * @param {number} userId - ID of the user
   * @returns {Promise<boolean>} Whether the user is a team member
   */
  public async isTeamMember(teamId: number, userId: number) {
    return await this.repo.isTeamMember(teamId, userId);
  }

  /**
   * Deletes a team invitation
   * @param {number} invitationId - ID of the invitation to delete
   * @returns {Promise<void>}
   * @throws {Error} When invitation deletion fails
   */
  public async deleteInvitation(invitationId: number) {
    try {
      return await this.repo.deleteInvitation(invitationId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
