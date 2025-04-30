import type { Context } from 'hono';

import { logger } from '../../lib/logger.ts';
import type { MembershipService } from '../../service/membership.ts';
import type { UserService } from '../../service/user.ts';
import type { CreateMembershipBody, UpdateMembershipBody } from '../validator/membership.ts';
import { ERRORS, serveBadRequest, serveInternalServerError, serveNotFound } from './resp/error.ts';

export class MembershipController {
  private service: MembershipService;
  private userService: UserService;

  constructor(service: MembershipService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public getMemberships = async (c: Context) => {
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

      // Admin users (master/owner) can see all memberships
      if (user.role === 'master' || user.role === 'owner') {
        const result = await this.service.getAllMemberships(query);
        return c.json(result);
      }
      // Get hostId from context and if hostId exists (team access), get resources for that host
      const hostId = c.get('hostId');
      if (hostId) {
        const result = await this.service.getMembershipsByUser(hostId, query);
        return c.json(result);
      }
      // Regular users only see their own memberships
      const result = await this.service.getMembershipsByUser(user.id, query);
      //sort by dates
      const sortedPlans = result.plans.sort((a, b) => {
        const minDateA = Math.min(...(a.dates?.map((d) => parseInt(d.date)) || [0]));
        const minDateB = Math.min(...(b.dates?.map((d) => parseInt(d.date)) || [0]));
        return minDateA - minDateB;
      });

      return c.json({ plans: sortedPlans, total: result.total });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getMembership = async (c: Context) => {
    try {
      const planId = Number(c.req.param('id'));
      const plan = await this.service.getMembership(planId);

      if (!plan) {
        return serveNotFound(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }

      return c.json(plan);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public createMembership = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: CreateMembershipBody = await c.req.json();
      if (body.price_point === 'standalone') {
        if (!body.dates || body.dates.length < 1) {
          return serveBadRequest(c, ERRORS.EVENT_DATE_REQUIRED);
        }
      }
      const planId = await this.service.createMembership(
        {
          ...body,
          user_id: user.id,
        },
        body.dates,
      );
      return c.json(
        {
          message: 'Membership created successfully',
          planId: planId,
        },
        201,
      );
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public updateMembership = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const planId = Number(c.req.param('id'));
      const plan = await this.service.getMembership(planId);

      if (!plan) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }

      if (plan.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body: UpdateMembershipBody = await c.req.json();
      const { name, description, price, payment_type, price_point } = body;
      await this.service.updateMembership(planId, {
        name,
        description,
        price,
        payment_type,
        price_point,
      });

      return c.json({ message: 'Membership updated successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteMembership = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const planId = Number(c.req.param('id'));
      const plan = await this.service.getMembership(planId);

      if (!plan) {
        return serveNotFound(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }
      if (plan.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      // Get all events linked to this membership
      const events = await this.service.getEventsByMembership(planId);

      // If there are events, check if any are active
      if (events.length > 0) {
        const hasActiveEvents = events.some((event) => event.status === 'active');
        if (hasActiveEvents) {
          //join with conjunction
          const formatter = new Intl.ListFormat('en', {
            style: 'long',
            type: 'conjunction',
          });
          const event_names = formatter.format(events.map((event) => event.event_name));

          return c.json(
            {
              hasActiveEvents,
              events,
              event_names,
              message: `This membership is linked to ${event_names}. Deleting this will cause issues with existing contacts registered for the event. Please cancel the event first then try again.`,
            },
            400,
          );
        }
      }

      // If no active events or no events at all, proceed with deletion
      await this.service.deleteMembership(planId);
      return c.json({ message: 'Membership deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getEventDates = async (c: Context) => {
    try {
      const membershipId = Number(c.req.param('id'));
      const dates = await this.service.getMembershipDates(membershipId);
      return c.json(dates);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteMembershipDate = async (c: Context) => {
    try {
      const dateId = Number(c.req.param('dateId'));
      await this.service.deleteMembershipDate(dateId);
      return c.json({ message: 'Date deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
