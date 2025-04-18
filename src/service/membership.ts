import { logger } from '../lib/logger.ts';
import type { MembershipRepository } from '../repository/membership.ts';
import type { Membership, NewMembership } from '../schema/schema.ts';

type MembershipQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

export class MembershipService {
  private repository: MembershipRepository;

  constructor(repository: MembershipRepository) {
    this.repository = repository;
  }

  public async createMembership(plan: NewMembership, dates: string[]): Promise<number> {
    try {
      const id = await this.repository.create(plan);
      // Create all event dates in parallel
      if (dates && Array.isArray(dates)) {
        await Promise.all(
          dates.map((date) =>
            this.repository.createMembershipDate({
              membership_id: id,
              date: date,
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
    return await this.repository.findAll(query);
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
      return await this.repository.findByUserId(userId, query);
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
}
