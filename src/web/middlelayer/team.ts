import { createMiddleware } from "hono/factory";
import { TeamService } from "../../service/team.js";
import { ERRORS, serveBadRequest } from "../controller/resp/error.js";
import { logger } from "../../lib/logger.js";

export const teamAccess = (teamService: TeamService) =>
  createMiddleware(async (c, next) => {
    const teamId = c.req.query("teamId");

    if (teamId) {
      const userId = c.get("jwtPayload").id;

      // Get team with its members
      const { members } = await teamService.getTeamMembers(Number(teamId));

      if (!members) {
        return serveBadRequest(c, ERRORS.TEAM_NOT_FOUND);
      }

      // Convert members object to array and find host
      const membersArray = Object.values(members);
      const hostMember = membersArray.find((member) => member.role === "host");

      if (!hostMember) {
        return serveBadRequest(c, ERRORS.TEAM_NOT_FOUND);
      }

      // Check if user is a member
      const isMember = membersArray.some((member) => member.user_id === userId);
      if (!isMember) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      // Set the host ID in the context for downstream use
      c.set("hostId", hostMember.user_id);
    }

    await next();
  });
