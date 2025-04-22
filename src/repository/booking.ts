import { and, eq } from 'drizzle-orm';

import { db } from '../lib/database.js';
import type { NewBooking } from '../schema/schema.js';
import { bookings } from '../schema/schema.js';
import { eventSchema } from '../schema/schema.js';

export class BookingRepository {
  public async create(booking: NewBooking) {
    return db.insert(bookings).values(booking).$returningId();
  }

  public async findByLeadId(leadId: number) {
    return db.query.bookings.findMany({
      where: eq(bookings.lead_id, leadId),
      with: {
        event: true,
      },
    });
  }

  public async findByUserIdandLeadId(userId: number, leadId: number) {
    return db
      .select({
        id: bookings.id,
        lead_id: bookings.lead_id,
        host_id: bookings.host_id,
        event_id: bookings.event_id,
        created_at: bookings.created_at,
        updated_at: bookings.updated_at,
        event: {
          id: eventSchema.id,
          event_name: eventSchema.event_name,
          event_description: eventSchema.event_description,
          status: eventSchema.status,
          created_at: eventSchema.created_at,
          updated_at: eventSchema.updated_at,
        },
      })
      .from(bookings)
      .leftJoin(eventSchema, eq(bookings.event_id, eventSchema.id))
      .where(and(eq(bookings.host_id, userId), eq(bookings.lead_id, leadId)));
  }
}
