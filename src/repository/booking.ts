import { eq } from "drizzle-orm";
import { db } from "../lib/database.js";
import { bookings } from "../schema/schema.js";
import type { NewBooking } from "../schema/schema.js";

export class BookingRepository {
  public async create(booking: NewBooking) {
    return db.insert(bookings).values(booking).$returningId();
  }

  public async findByLeadId(leadId: number) {
    return db.select().from(bookings).where(eq(bookings.lead_id, leadId));
  }
}
