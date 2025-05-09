import { logger } from '../lib/logger.ts';
import type { MembershipRepository } from '../repository/membership.ts';
import type { Membership, NewMembership } from '../schema/schema.ts';

/**
 * Type for membership query parameters
 */
type MembershipQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

/**
 * Type for membership plan with associated date
 */
type MembershipPlanWithDate = NewMembership & {
  date: string;
};

/**
 * Service class for managing memberships, including creation, updates, and date management
 */
export class MembershipService {
  private repository: MembershipRepository;

  /**
   * Creates an instance of MembershipService
   * @param {MembershipRepository} repository - Repository for membership operations
   */
  constructor(repository: MembershipRepository) {
    this.repository = repository;
  }

  /**
   * Creates a new membership plan with optional dates
   * @param {NewMembership} plan - The membership plan to create
   * @param {string[]|null|undefined} dates - Optional array of dates for the membership
   * @returns {Promise<number>} ID of the created membership
   * @throws {Error} When membership creation fails
   */
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

  /**
   * Retrieves a membership by its ID
   * @param {number} id - ID of the membership
   * @returns {Promise<Membership|undefined>} The membership if found
   */
  public async getMembership(id: number): Promise<Membership | undefined> {
    return await this.repository.find(id);
  }

  /**
   * Retrieves all memberships with optional filtering
   * @param {MembershipQuery} [query] - Query parameters for filtering memberships
   * @returns {Promise<{plans: Membership[], total: number}>} List of memberships and total count
   */
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

  /**
   * Updates a membership plan
   * @param {number} id - ID of the membership to update
   * @param {Partial<Membership>} plan - Updated membership data
   * @returns {Promise<void>}
   */
  public async updateMembership(id: number, plan: Partial<Membership>): Promise<void> {
    await this.repository.update(id, plan);
  }

  /**
   * Deletes a membership plan
   * @param {number} id - ID of the membership to delete
   * @returns {Promise<void>}
   */
  public async deleteMembership(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Retrieves memberships for a specific user
   * @param {number} userId - ID of the user
   * @param {MembershipQuery} [query] - Query parameters for filtering memberships
   * @returns {Promise<{plans: Membership[], total: number}>} List of memberships and total count
   * @throws {Error} When membership retrieval fails
   */
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

  /**
   * Retrieves events associated with a membership
   * @param {number} membershipId - ID of the membership
   * @returns {Promise<Array>} List of events for the membership
   * @throws {Error} When event retrieval fails
   */
  public async getEventsByMembership(membershipId: number) {
    try {
      return await this.repository.getEventsByMembership(membershipId);
    } catch (error) {
      logger.error('Failed to get events by membership:', error);
      throw error;
    }
  }

  /**
   * Retrieves dates associated with a membership
   * @param {number} membershipId - ID of the membership
   * @returns {Promise<Array>} List of dates for the membership
   * @throws {Error} When date retrieval fails
   */
  public async getMembershipDates(membershipId: number) {
    try {
      return await this.repository.getMembershipDates(membershipId);
    } catch (error) {
      logger.error('Failed to get membership dates:', error);
      throw error;
    }
  }

  /**
   * Deletes a membership date
   * @param {number} dateId - ID of the date to delete
   * @returns {Promise<void>}
   * @throws {Error} When date deletion fails
   */
  public async deleteMembershipDate(dateId: number) {
    try {
      await this.repository.deleteMembershipDate(dateId);
    } catch (error) {
      logger.error('Failed to delete membership date:', error);
      throw error;
    }
  }

  /**
   * Updates a membership date
   * @param {number} dateId - ID of the date to update
   * @param {{date: string}} update - Updated date information
   * @returns {Promise<void>}
   * @throws {Error} When date update fails
   */
  public async updateMembershipDate(dateId: number, update: { date: string }) {
    try {
      await this.repository.updateMembershipDate(dateId, update);
    } catch (error) {
      logger.error('Failed to update membership date:', error);
      throw error;
    }
  }

  /**
   * Retrieves memberships associated with an event
   * @param {number} eventId - ID of the event
   * @returns {Promise<Array>} List of memberships for the event
   */
  public async getEventMemberships(eventId: number) {
    return await this.repository.getEventMemberships(eventId);
  }

  /**
   * Retrieves multiple membership dates by their IDs
   * @param {number[]} dates - Array of date IDs
   * @returns {Promise<Array>} List of membership dates
   */
  public async getMultipleMembershipDates(dates: number[]) {
    return await this.repository.getMultipleMembershipDates(dates);
  }

  /**
   * Retrieves multiple memberships by their IDs
   * @param {number[]} ids - Array of membership IDs
   * @returns {Promise<Membership[]>} List of memberships
   * @throws {Error} When membership retrieval fails
   */
  public async getMultipleMemberships(ids: number[]): Promise<Membership[]> {
    try {
      return await this.repository.findMultiple(ids);
    } catch (error) {
      logger.error('Failed to get multiple memberships:', error);
      throw error;
    }
  }

  /**
   * Creates multiple membership plans in batch
   * @param {number} eventId - ID of the event
   * @param {MembershipPlanWithDate[]} plans - Array of membership plans with dates
   * @returns {Promise<Membership[]>} List of created memberships
   * @throws {Error} When batch creation fails
   */
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

  /**
   * Creates membership plans for an event
   * @param {number} eventId - ID of the event
   * @param {Membership[]} memberships - Array of memberships to create
   * @returns {Promise<Array>} Created membership plans
   */
  public async createMembershipPlans(eventId: number, memberships: Membership[]) {
    return await this.repository.createMembershipPlans(eventId, memberships);
  }
}
