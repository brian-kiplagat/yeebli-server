import { logger } from '../lib/logger.ts';
import type { BookingRepository } from '../repository/booking.ts';
import type { NewBooking } from '../schema/schema.ts';

export class BookingService {
  private repo: BookingRepository;

  constructor(bookingRepo: BookingRepository) {
    this.repo = bookingRepo;
  }

  public async create(booking: NewBooking) {
    try {
      return await this.repo.create(booking);
    } catch (error) {
      logger.error('Failed to create booking:', error);
      throw error;
    }
  }

  public async findByLeadId(leadId: number) {
    return this.repo.findByLeadId(leadId);
  }

  public async findByUserIdandLeadId(userId: number, leadId: number) {
    return this.repo.findByUserIdandLeadId(userId, leadId);
  }
}
