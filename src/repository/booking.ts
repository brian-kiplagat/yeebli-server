import { eq } from "drizzle-orm";
import { db } from "../lib/database.js";
import { bookings } from "../schema/schema.js";
import type { NewBooking } from "../schema/schema.js";

export class BookingRepository {
  public async create(booking: NewBooking) {
    return db.insert(bookings).values(booking).$returningId();
  }

  public async findByLeadId(leadId: number) {
    return db.query.bookings.findMany({
      where: eq(bookings.lead_id, leadId),
      with: {
        event: true,
        date: true,
      },
    });
  }

  public async findByDateId(dateId: number) {
    return db.select().from(bookings).where(eq(bookings.date_id, dateId));
  }
}
