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
  InviteMemberBody,
  type TeamQuery,
  inviteMemberValidator,
  teamQueryValidator,
} from "../validator/team.ts";

export class TeamController {
  private service: TeamService;
  private userService: UserService;

  constructor(service: TeamService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const userId = c.get("userId");
    if (!userId) {
      return null;
    }
    return await this.userService.find(userId);
  }

  public inviteMember = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: InviteMemberBody = await c.req.json();
      const { invitee_email } = body;

      const invitationId = await this.service.inviteMember(
        user.team_id,
        user.id,
        invitee_email
      );

      return c.json({
        message: "Invitation sent successfully",
        invitation_id: invitationId,
      });
    } catch (error) {
      logger.error("Error inviting member:", error);
      return serveInternalServerError(c, error);
    }
  };

  public getTeamInvitations = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const invitations = await this.service.getTeamInvitations(user.team_id);
      return c.json({ invitations });
    } catch (error) {
      logger.error("Error getting team invitations:", error);
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
      return c.json({ invitations });
    } catch (error) {
      logger.error("Error getting my invitations:", error);
      return serveInternalServerError(c, error);
    }
  };

  public acceptInvitation = async (c: Context) => {
    try {
      const invitationId = Number(c.req.param("id"));
      const invitation = await this.service.acceptInvitation(invitationId);

      return c.json({
        message: "Invitation accepted successfully",
        invitation,
      });
    } catch (error) {
      logger.error("Error accepting invitation:", error);
      return serveInternalServerError(c, error);
    }
  };

  public rejectInvitation = async (c: Context) => {
    try {
      const invitationId = Number(c.req.param("id"));
      const invitation = await this.service.rejectInvitation(invitationId);

      return c.json({
        message: "Invitation rejected successfully",
        invitation,
      });
    } catch (error) {
      logger.error("Error rejecting invitation:", error);
      return serveInternalServerError(c, error);
    }
  };
}
