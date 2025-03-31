import type { Context } from 'hono';
import { logger } from '../../lib/logger.js';
import type { BookingService } from '../../service/booking.js';
import { ERRORS, serveBadRequest } from './resp/error.js';

export class BookingController {
  private bookingService: BookingService;

  constructor(bookingService: BookingService) {
    this.bookingService = bookingService;
  }

  public createBooking = async (c: Context) => {
    try {
      const body = await c.req.json();
      const { event_id, date_id, lead_id } = body;

      // Validate the booking
      const booking = await this.bookingService.create({
        event_id,
        date_id,
        lead_id,
      });

      return c.json({
        success: true,
        booking,
      });
    } catch (error) {
      logger.error('Failed to create booking:', error);
      return serveBadRequest(c, ERRORS.BOOKING_FAILED);
    }
  };

  public getBookingsByLead = async (c: Context) => {
    try {
      const lead_id = c.req.param('lead_id');
      const bookings = await this.bookingService.findByLeadId(Number(lead_id));

      return c.json({
        success: true,
        bookings,
      });
    } catch (error) {
      logger.error('Failed to get bookings:', error);
      return serveBadRequest(c, ERRORS.BOOKING_NOT_FOUND);
    }
  };
}
