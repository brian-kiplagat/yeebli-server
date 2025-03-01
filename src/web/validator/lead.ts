import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
/**
 * Lead Schema
 * id: serial("id").primaryKey(),
 *  membershipLevel: varchar("membership_level", { length: 50 }),
 *  membershipActive: boolean("membership_active").default(false),
 *  formIdentifier: varchar("form_identifier", { length: 100 }),
 *  hostId: int("host_id").references(() => userSchema.id),
 *  createdAt: timestamp("created_at").defaultNow(),
 *  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
 *  status_identifier: mysqlEnum("status_identifier", [
 *    "Free Event",
 *    "Event Interested",
 *    "Membership- Silver",
 *    "Membership- Gold",
 *    "Membership- Platinum",
 *  ]).default("Free Event"),
 *  userId: int("user_id").references(() => userSchema.id),
 */
const leadSchema = z.object({
  membershipLevel: z.string().min(1, "Membership Level is required"),
  membershipActive: z.boolean().default(false),
  formIdentifier: z.string().min(1, "Form Identifier is required"),
  hostId: z.number().min(1, "Host ID is required"),
  status_identifier: z.string().optional(),
  userId: z.number().optional(),
});

export const leadValidator = zValidator("json", leadSchema);
