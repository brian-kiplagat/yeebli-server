import type { BookingRepository } from "../repository/booking.js";
import type { NewBooking } from "../schema/schema.js";
import { logger } from "../lib/logger.js";

export class BookingService {
  private repo: BookingRepository;

  constructor(bookingRepo: BookingRepository) {
    this.repo = bookingRepo;
  }

  public async create(booking: NewBooking) {
    try {
      return await this.repo.create(booking);
    } catch (error) {
      logger.error("Failed to create booking:", error);
      throw error;
    }
  }

  public async findByLeadId(leadId: number) {
    return this.repo.findByLeadId(leadId);
  }
}
