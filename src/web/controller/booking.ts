import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import type { BookingService } from '../../service/booking.js';
import { UserService } from '../../service/user.js';
import { ERRORS, serveBadRequest } from './resp/error.js';

export class BookingController {
  private bookingService: BookingService;
  private userService: UserService;

  constructor(bookingService: BookingService, userService: UserService) {
    this.bookingService = bookingService;
    this.userService = userService;
  }
  private getUser = async (c: Context) => {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  };

  public createBooking = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body = await c.req.json();
      const { event_id, lead_id } = body;

      // Validate the booking
      const booking = await this.bookingService.create({
        event_id,
        lead_id,
        host_id: user.id,
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
