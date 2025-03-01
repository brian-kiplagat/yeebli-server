import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export const eventValidator = zValidator(
  "json",
  z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    location: z.string().optional(),
    type: z.string().optional(),
  })
);
