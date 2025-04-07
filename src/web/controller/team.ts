import type { Context } from "hono";
import { logger } from "../../lib/logger.ts";
import type { TeamService } from "../../service/team.ts";
import type { UserService } from "../../service/user.ts";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveNotFound,
} from "./resp/error.ts";
import { serveData } from "./resp/resp.ts";
import {
  type CreateTeamBody,
  type InviteMemberBody,
  type TeamQuery,
  createTeamValidator,
  inviteMemberValidator,
  teamQueryValidator,
} from "../validator/team.ts";
import type { User, TeamMember } from "../../schema/schema.ts";

export class TeamController {
  private service: TeamService;
  private userService: UserService;

  constructor(service: TeamService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context): Promise<User | null> {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user ?? null;
  }

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
        message: "Team created successfully",
        team,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public inviteMember = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: InviteMemberBody = await c.req.json();
      const { invitee_email, team_id } = body;

      // Check if inviter is the host of the team
      const isHost = await this.service.repo.isTeamHost(team_id, user.id);
      if (!isHost) {
        return serveBadRequest(c, "Only the team host can invite members");
      }

      // Get team details
      const team = await this.service.repo.getTeamById(team_id);
      if (!team) {
        return serveBadRequest(c, "Team not found");
      }

      // Check if user already exists
      const existingUser =
        await this.service.userService.findByEmail(invitee_email);
      if (existingUser) {
        // Check if invitee is already a team member
        const userTeams = await this.service.repo.getUserTeams(existingUser.id);
        if (userTeams.some((team: TeamMember) => team.team_id === team_id)) {
          return serveBadRequest(c, "User is already a member of this team");
        }
      } else {
        // Check if there's already a pending invitation for this email
        const existingInvitations =
          await this.service.repo.getInvitationsByEmail(invitee_email);
        if (
          existingInvitations.some(
            (inv) => inv.team_id === team_id && inv.status === "pending"
          )
        ) {
          return serveBadRequest(
            c,
            "This user already has a pending invitation to this team"
          );
        }
      }

      const invitation = await this.service.inviteMember(
        team.id,
        user.id,
        invitee_email,
        team.name
      );

      return c.json({
        message: "Invitation sent successfully",
        invitation,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getTeamInvitations = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const invitations = await this.service.getTeamInvitations(user.id);

      return c.json(invitations);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getMyInvitations = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const invitations = await this.service.getMyInvitations(user.email);

      return c.json(invitations);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public acceptInvitation = async (c: Context) => {
    try {
      const invitationId = Number(c.req.param("id"));

      // Check if invitation exists
      const invitation = await this.service.repo.getInvitation(invitationId);
      if (!invitation) {
        return serveBadRequest(c, "Invitation not found");
      }

      const result = await this.service.acceptInvitation(invitationId);

      return c.json({
        message: "Invitation accepted successfully",
        invitation: result,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public rejectInvitation = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const invitationId = Number(c.req.param("id"));

      // Check if invitation exists
      const invitation = await this.service.repo.getInvitation(invitationId);
      if (!invitation) {
        return serveBadRequest(c, "Invitation not found");
      }

      // Check if invitation is for this user
      if (invitation.invitee_email !== user.email) {
        return serveBadRequest(c, "This invitation is not for you");
      }

      const result = await this.service.rejectInvitation(invitationId);

      return c.json({
        message: "Invitation rejected successfully",
        invitation: result,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
