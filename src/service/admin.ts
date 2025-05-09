import type { AdminRepository } from '../repository/admin.ts';
import type { AdminEventQuery, AdminLeadQuery, AdminUserQuery } from '../web/validator/admin.ts';

/**
 * Service class for handling administrative operations
 */
export class AdminService {
  private repository: AdminRepository;

  constructor(repository: AdminRepository) {
    this.repository = repository;
  }

  /**
   * Retrieves a list of users based on query parameters
   * @param {AdminUserQuery} query - Query parameters for filtering users
   * @returns {Promise<Array>} List of users matching the query criteria
   */
  public async getUsers(query: AdminUserQuery) {
    return this.repository.getUsers(query);
  }

  /**
   * Retrieves a list of owner users based on query parameters
   * @param {AdminUserQuery} query - Query parameters for filtering owners
   * @returns {Promise<Array>} List of owners matching the query criteria
   */
  public async getOwners(query: AdminUserQuery) {
    return this.repository.getUsers(query);
  }

  /**
   * Retrieves a list of leads based on query parameters
   * @param {AdminLeadQuery} query - Query parameters for filtering leads
   * @returns {Promise<Array>} List of leads matching the query criteria
   */
  public async getLeads(query: AdminLeadQuery) {
    return this.repository.getLeads(query);
  }

  /**
   * Retrieves a list of events based on query parameters
   * @param {AdminEventQuery} query - Query parameters for filtering events
   * @returns {Promise<Array>} List of events matching the query criteria
   */
  public async getEvents(query: AdminEventQuery) {
    return this.repository.getEvents(query);
  }
}
