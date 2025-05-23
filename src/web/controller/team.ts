import type { Context } from 'hono';

import { logger } from '../../lib/logger.ts';
import type { TeamMember, User } from '../../schema/schema.ts';
import { BusinessService } from '../../service/business.ts';
import type { TeamService } from '../../service/team.ts';
import type { UserService } from '../../service/user.ts';
import {
  type CreateTeamBody,
  type InviteMemberBody,
  type RevokeAccessBody,
} from '../validator/team.ts';
import { ERRORS, serveBadRequest, serveInternalServerError } from './resp/error.ts';
import { serveData } from './resp/resp.ts';
export class TeamController {
  private service: TeamService;
  private userService: UserService;
  private businessService: BusinessService;

  constructor(service: TeamService, userService: UserService, businessService: BusinessService) {
    this.service = service;
    this.userService = userService;
    this.businessService = businessService;
  }

  /**
   * Get a user from the context
   * @param c
   * @returns A user or null if the user is not found
   */
  private async getUser(c: Context): Promise<User | null> {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user ?? null;
  }

  /**
   * Create a team
   * @param c
   * @returns A message indicating that the team has been created
   */
  public createTeam = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: CreateTeamBody = await c.req.json();
      const { name } = body;

      const team = await this.service.createTeam(name, user.id);

      return c.json({
        message: 'Team created successfully',
        team,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Invite a member to a team
   * @param c
   * @returns A message indicating that the invitation has been sent
   */
  public inviteMember = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: InviteMemberBody = await c.req.json();
      const { invitee_email, team_id } = body;

      // Check if inviter is the host of the team
      const isHost = await this.service.isTeamHost(team_id, user.id);
      if (!isHost) {
        return serveBadRequest(c, 'Only the team host can invite members');
      }

      // Get team details
      const team = await this.service.getTeamById(team_id);
      if (!team) {
        return serveBadRequest(c, 'Team not found');
      }

      // Check if user already exists
      const existingUser = await this.service.userService.findByEmail(invitee_email);
      if (existingUser) {
        // Check if invitee is already a team member
        const userTeams = await this.service.getUserTeams(existingUser.id);
        if (userTeams.some((team: TeamMember) => team.team_id === team_id)) {
          return serveBadRequest(c, 'User is already a member of this team');
        }
      } else {
        // Check if there's already a pending invitation for this email
        const existingInvitations = await this.service.getMyInvitations(invitee_email);
        if (
          existingInvitations.some((inv) => inv.team_id === team_id && inv.status === 'pending')
        ) {
          return serveBadRequest(c, 'This user already has a pending invitation to this team');
        }
      }

      const invitation = await this.service.inviteMember(
        team.id,
        user.id,
        invitee_email,
        team.name,
      );

      return c.json({
        message: 'Invitation sent successfully',
        invitation,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Get all invitations for a team
   * @param c
   * @returns An array of invitations for a team
   */
  public getTeamInvitations = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      //get the team where the user is host
      const team = await this.service.getTeamByHostId(user.id);
      if (!team) {
        return serveBadRequest(c, 'You are not a host of any team');
      }

      const invitations = await this.service.getTeamInvitations(team.id);

      return c.json(invitations);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Get all invitations for a user
   * @param c
   * @returns An array of invitations for a user
   */
  public getMyInvitations = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const invitations = await this.service.getMyInvitations(user.email, 'pending');

      // Format the response to include team and inviter information
      const formattedInvitations = invitations.map((invitation) => ({
        id: invitation.id,
        team_id: invitation.team_id,
        team_name: invitation.team?.name || 'Unknown Team',
        inviter_name: invitation.inviter?.name || 'Unknown',
        inviter_email: invitation.inviter?.email || 'Unknown',
        status: invitation.status,
        created_at: invitation.created_at,
        updated_at: invitation.updated_at,
      }));

      return serveData(c, formattedInvitations);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Accept an invitation
   * @param c
   * @returns A message indicating that the invitation has been accepted
   */
  public acceptInvitation = async (c: Context) => {
    try {
      const invitationId = Number(c.req.param('id'));

      // Check if invitation exists
      const invitation = await this.service.repo.getInvitation(invitationId);
      if (!invitation) {
        return serveBadRequest(c, 'Invitation not found');
      }

      // Check if invitation is already accepted
      if (invitation.status === 'accepted') {
        return serveBadRequest(c, 'This invitation has already been accepted');
      }

      // Check if invitation is already rejected
      if (invitation.status === 'rejected') {
        return serveBadRequest(c, 'This invitation has already been rejected');
      }

      const result = await this.service.acceptInvitation(invitationId);

      return c.json({
        message: 'Invitation accepted successfully',
        invitation: result,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Reject an invitation
   * @param c
   * @returns A message indicating that the invitation has been rejected
   */
  public rejectInvitation = async (c: Context) => {
    try {
      const invitationId = Number(c.req.param('id'));

      // Check if invitation exists
      const invitation = await this.service.repo.getInvitation(invitationId);
      if (!invitation) {
        return serveBadRequest(c, 'Invitation not found');
      }

      const result = await this.service.rejectInvitation(invitationId);

      return c.json({
        message: 'Invitation rejected successfully',
        invitation: result,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Get all team members for the user's team
   * @param {Context} c - The Hono context containing user information
   * @returns {Promise<Response>} Response containing list of team members
   * @throws {Error} When fetching team members fails
   */
  public getMyTeamMembers = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const { page, limit, search } = c.req.query();
      const query = {
        page: page ? Number.parseInt(page) : undefined,
        limit: limit ? Number.parseInt(limit) : undefined,
        search,
      };

      // Get the team where user is host
      const teamMember = await this.service.getTeamByHostId(user.id);
      if (!teamMember) {
        return serveBadRequest(c, 'You are not a host of any team');
      }

      const members = await this.service.getTeamMembers(teamMember.team_id, query);
      if (!members) {
        return serveBadRequest(c, 'No members found in your team');
      }

      // Format response to include only name, email, phone, and role
      const formattedMembers = members.members.map((member) => ({
        name: member.user?.name || 'Unknown',
        email: member.user?.email || 'Unknown',
        phone: member.user?.phone || 'Unknown',
        role: member.role,
        memberId: member.id,
      }));

      return c.json({
        team_id: teamMember.team_id,
        team_name: teamMember.team.name,
        members: formattedMembers,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Get all teams that the user is a member of
   * @param {Context} c - The Hono context containing user information
   * @returns {Promise<Response>} Response containing list of teams
   * @throws {Error} When fetching teams fails
   */
  public getMyTeams = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const teamMembers = await this.service.getUserTeams(user.id);

      // Get team details for each team
      const teamDetails = await Promise.all(
        teamMembers.map(async (member) => {
          const teamInfo = await this.service.getTeamById(member.team_id);
          //get the host of the team
          const host_id = teamInfo?.members.find((m) => m.role === 'host')?.user_id;
          if (!host_id) {
            return {
              team_id: member.team_id,
              team_name: teamInfo?.name || 'Unknown Team',
              role: member.role,
              created_at: member.created_at,
              updated_at: member.updated_at,
            };
          }
          //get the business related to the host
          const business = await this.businessService.getBusinessDetailsByUserId(host_id);
          return {
            team_id: member.team_id,
            team_name: teamInfo?.name || 'Unknown Team',
            role: member.role,
            created_at: member.created_at,
            updated_at: member.updated_at,
            business,
          };
        }),
      );

      return c.json(teamDetails);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Revoke access for a team member
   * @param {Context} c - The Hono context containing revocation details
   * @returns {Promise<Response>} Response indicating revocation status
   * @throws {Error} When revoking access fails
   */
  public revokeAccess = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: RevokeAccessBody = await c.req.json();
      const { team_id, member_id } = body;

      if (!team_id || !member_id) {
        return serveBadRequest(c, 'Team ID and Member ID are required');
      }

      // Verify that the requester is the host
      const isHost = await this.service.isTeamHost(team_id, user.id);
      if (!isHost) {
        return serveBadRequest(c, 'Only the team host can revoke access');
      }

      // Verify that the user is not trying to remove themselves
      if (member_id === user.id) {
        return serveBadRequest(c, 'Cannot revoke your own access');
      }

      // Verify that the user is a member of the team
      const teamMembers = await this.service.getTeamMembers(team_id);
      const isMember = teamMembers.members.some((member) => member.user_id === member_id);
      if (!isMember) {
        return serveBadRequest(c, 'User is not a member of this team');
      }

      const result = await this.service.revokeAccess(team_id, member_id);

      return serveData(c, result);
    } catch (error) {
      logger.error(error);
      if (error instanceof Error) {
        return serveBadRequest(c, error.message);
      }
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Delete a pending team invitation
   * @param {Context} c - The Hono context containing invitation ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When deleting invitation fails
   */
  public deleteInvitation = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const invitationId = Number(c.req.param('id'));
      if (!invitationId) {
        return serveBadRequest(c, 'Invitation ID is required');
      }

      // Get the invitation to verify ownership
      const invitation = await this.service.getInvitation(invitationId);
      if (!invitation) {
        return serveBadRequest(c, 'Invitation not found');
      }

      // Verify that the user is the inviter
      if (invitation.inviter_id !== user.id) {
        return serveBadRequest(c, 'You do not have permission to delete this invitation');
      }

      // Delete the invitation
      await this.service.deleteInvitation(invitationId);

      return c.json({
        success: true,
        message: 'Invitation deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting invitation:', error);
      return serveInternalServerError(c, error);
    }
  };
}
