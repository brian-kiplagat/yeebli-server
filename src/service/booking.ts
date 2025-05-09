import { logger } from '../lib/logger.ts';
import type { BookingRepository } from '../repository/booking.ts';
import type { NewBooking } from '../schema/schema.ts';

/**
 * Service class for managing event bookings
 */
export class BookingService {
  private repo: BookingRepository;

  constructor(bookingRepo: BookingRepository) {
    this.repo = bookingRepo;
  }

  /**
   * Creates a new booking
   * @param {NewBooking} booking - The booking details to create
   * @returns {Promise<Booking>} The created booking
   * @throws {Error} When booking creation fails
   */
  public async create(booking: NewBooking) {
    try {
      return await this.repo.create(booking);
    } catch (error) {
      logger.error('Failed to create booking:', error);
      throw error;
    }
  }

  /**
   * Finds all bookings for a specific lead
   * @param {number} leadId - ID of the lead
   * @returns {Promise<Booking[]>} List of bookings for the lead
   */
  public async findByLeadId(leadId: number) {
    return this.repo.findByLeadId(leadId);
  }

  /**
   * Finds bookings for a specific user and lead combination
   * @param {number} userId - ID of the user
   * @param {number} leadId - ID of the lead
   * @returns {Promise<Booking[]>} List of bookings matching the criteria
   */
  public async findByUserIdandLeadId(userId: number, leadId: number) {
    return this.repo.findByUserIdandLeadId(userId, leadId);
  }
}
