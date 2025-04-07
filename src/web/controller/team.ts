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
import type { User } from "../../schema/schema.ts";

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
      logger.error("Error creating team:", { error });
      return serveInternalServerError(c, error);
    }
  };

  public inviteMember = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body = await c.req.json();
      const { email } = body;

      const invitation = await this.service.inviteMember(
        user.id,
        user.id,
        email
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
      logger.error("Error getting team invitations:", { error });
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
      logger.error("Error getting my invitations:", { error });
      return serveInternalServerError(c, error);
    }
  };

  public acceptInvitation = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const invitationId = Number(c.req.param("id"));
      const invitation = await this.service.acceptInvitation(invitationId);

      return c.json({
        message: "Invitation accepted successfully",
        invitation,
      });
    } catch (error) {
      logger.error("Error accepting invitation:", { error });
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
      const invitation = await this.service.rejectInvitation(invitationId);

      return c.json({
        message: "Invitation rejected successfully",
        invitation,
      });
    } catch (error) {
      logger.error("Error rejecting invitation:", { error });
      return serveInternalServerError(c, error);
    }
  };
}
