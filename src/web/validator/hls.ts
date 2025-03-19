import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const MAX_FILE_SIZE = 1024 * 1024 * 500; // 500MB

export const resolutionSchema = z.enum(["1080p", "720p", "480p", "360p"]);

export const hlsUploadSchema = z.object({
  file: z.object({
    name: z
      .string()
      .endsWith(".mp4", { message: "Only MP4 files are supported" }),
    size: z.number().max(MAX_FILE_SIZE, {
      message: `File size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    }),
    type: z.string().refine((type) => type === "video/mp4", {
      message: "Content type must be video/mp4",
    }),
  }),
  resolutions: z
    .array(resolutionSchema)
    .min(1, { message: "At least one resolution must be selected" })
    .max(4, { message: "Maximum 4 resolutions can be selected" })
    .default(["720p", "480p"]),
});

export const hlsUploadValidator = zValidator("form", hlsUploadSchema);

export type HLSUploadRequest = z.infer<typeof hlsUploadSchema>;


export type Resolution = z.infer<typeof resolutionSchema>;
