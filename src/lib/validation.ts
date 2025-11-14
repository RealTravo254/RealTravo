import { z } from "zod";

// Guest booking validation schema
export const guestBookingSchema = z.object({
  name: z.string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name contains invalid characters"),
  email: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  phone: z.string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format (10-15 digits)"),
});

// Payment phone validation schema
export const paymentPhoneSchema = z.string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format (10-15 digits)");
