import { logger } from '../lib/logger.ts';
import type { MembershipRepository } from '../repository/membership.ts';
import type { Membership, NewMembership } from '../schema/schema.ts';

type MembershipQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

type MembershipPlanWithDate = NewMembership & {
  date: string;
};

export class MembershipService {
  private repository: MembershipRepository;

  constructor(repository: MembershipRepository) {
    this.repository = repository;
  }

  public async createMembership(
    plan: NewMembership,
    dates: string[] | null | undefined,
  ): Promise<number> {
    try {
      const id = await this.repository.create(plan);
      // Create all event dates in parallel
      if (dates && Array.isArray(dates)) {
        await Promise.all(
          dates.map((date) =>
            this.repository.createMembershipDate({
              membership_id: id,
              date: date,
              user_id: plan.user_id,
            }),
          ),
        );
      }
      return id;
    } catch (error) {
      logger.error('Failed to create membership:', error);
      throw error;
    }
  }

  public async getMembership(id: number): Promise<Membership | undefined> {
    return await this.repository.find(id);
  }

  public async getAllMemberships(
    query?: MembershipQuery,
  ): Promise<{ plans: Membership[]; total: number }> {
    const result = await this.repository.findAll(query);
    // Group dates by membership
    const membershipMap = new Map<number, Membership>();
    result.plans.forEach(({ membership, date }) => {
      if (!membershipMap.has(membership.id)) {
        membershipMap.set(membership.id, { ...membership, dates: [] });
      }
      if (date) {
        const membershipObj = membershipMap.get(membership.id);
        if (membershipObj?.dates) {
          membershipObj.dates.push(date);
        }
      }
    });

    return {
      plans: Array.from(membershipMap.values()),
      total: result.total,
    };
  }

  public async updateMembership(id: number, plan: Partial<Membership>): Promise<void> {
    await this.repository.update(id, plan);
  }

  public async deleteMembership(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  public async getMembershipsByUser(
    userId: number,
    query?: MembershipQuery,
  ): Promise<{ plans: Membership[]; total: number }> {
    try {
      const result = await this.repository.findByUserId(userId, query);

      // Group dates by membership
      const membershipMap = new Map<number, Membership>();
      result.plans.forEach(({ membership, date }) => {
        if (!membershipMap.has(membership.id)) {
          membershipMap.set(membership.id, { ...membership, dates: [] });
        }
        if (date) {
          const membershipObj = membershipMap.get(membership.id);
          if (membershipObj?.dates) {
            membershipObj.dates.push(date);
          }
        }
      });

      return {
        plans: Array.from(membershipMap.values()),
        total: result.total,
      };
    } catch (error) {
      logger.error('Failed to get memberships by user:', error);
      throw error;
    }
  }

  public async getEventsByMembership(membershipId: number) {
    try {
      return await this.repository.getEventsByMembership(membershipId);
    } catch (error) {
      logger.error('Failed to get events by membership:', error);
      throw error;
    }
  }

  public async getMembershipDates(membershipId: number) {
    try {
      return await this.repository.getMembershipDates(membershipId);
    } catch (error) {
      logger.error('Failed to get membership dates:', error);
      throw error;
    }
  }

  public async deleteMembershipDate(dateId: number) {
    try {
      await this.repository.deleteMembershipDate(dateId);
    } catch (error) {
      logger.error('Failed to delete membership date:', error);
      throw error;
    }
  }

  public async updateMembershipDate(dateId: number, update: { date: string }) {
    try {
      await this.repository.updateMembershipDate(dateId, update);
    } catch (error) {
      logger.error('Failed to update membership date:', error);
      throw error;
    }
  }

  public async getEventMemberships(eventId: number) {
    return await this.repository.getEventMemberships(eventId);
  }

  public async getMultipleMembershipDates(dates: number[]) {
    return await this.repository.getMultipleMembershipDates(dates);
  }

  public async getMultipleMemberships(ids: number[]): Promise<Membership[]> {
    try {
      return await this.repository.findMultiple(ids);
    } catch (error) {
      logger.error('Failed to get multiple memberships:', error);
      throw error;
    }
  }

  public async batchCreateMembership(
    eventId: number,
    plans: MembershipPlanWithDate[],
  ): Promise<Membership[]> {
    try {
      // Create all memberships in parallel
      const memberships = await Promise.all(
        plans.map(async (plan) => {
          const { date, ...membershipData } = plan;
          const id = await this.repository.create(membershipData);
          return { ...membershipData, id, date } as Membership & { date: string };
        }),
      );

      // Batch insert all dates in a single operation
      const dateRecords = memberships.map((m) => ({
        membership_id: m.id,
        date: m.date,
        user_id: m.user_id,
      }));
      await this.repository.batchCreateMembershipDates(dateRecords);

      return memberships;
    } catch (error) {
      logger.error('Failed to batch create memberships:', error);
      throw error;
    }
  }

  public async createMembershipPlans(eventId: number, memberships: Membership[]) {
    return await this.repository.createMembershipPlans(eventId, memberships);
  }
}
