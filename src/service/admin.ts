import type { AdminRepository } from '../repository/admin.ts';
import type { AdminEventQuery, AdminLeadQuery, AdminUserQuery } from '../web/validator/admin.ts';

export class AdminService {
  private repository: AdminRepository;

  constructor(repository: AdminRepository) {
    this.repository = repository;
  }

  public async getUsers(query: AdminUserQuery) {
    return this.repository.getUsers(query);
  }

  public async getOwners(query: AdminUserQuery) {
    return this.repository.getUsers(query);
  }

  public async getLeads(query: AdminLeadQuery) {
    return this.repository.getLeads(query);
  }

  public async getEvents(query: AdminEventQuery) {
    return this.repository.getEvents(query);
  }
}
