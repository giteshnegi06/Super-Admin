import { z } from "zod";
import { CURRENCY_CODES } from "./currencies";

export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optStr = (max: number) => z.string().max(max).optional().or(z.literal(""));

export const createClientSchema = z.object({
  cafeName: z.string().min(2, "Cafe name is too short").max(80),
  slug: z.string().min(2).max(40).regex(slugRegex, "Lowercase letters, numbers and dashes only"),
  ownerName: z.string().min(2).max(80),
  ownerEmail: z.string().email(),
  ownerPhone: optStr(20),
  address: optStr(200),
  city: optStr(60),
  state: optStr(60),
  country: optStr(60),
  gstNumber: optStr(20),
  tagline: optStr(120),
  timeZone: z.string().min(1).max(60).default("Asia/Kolkata"),
  currency: z.string().refine((c) => CURRENCY_CODES.includes(c), "Unknown currency").default("INR"),
  initialTables: z.coerce.number().int().min(0).max(200).default(10),
  appUrl: z.string().url().optional().or(z.literal("")),
  notes: optStr(2000),
  provisionNow: z.coerce.boolean().default(true),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.omit({ slug: true, provisionNow: true }).partial();

export const commissionSchema = z.object({
  commissionEnabled: z.coerce.boolean().default(false),
  commissionPercent: z.coerce.number().min(0, "Cannot be negative").max(100, "Cannot exceed 100%"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
