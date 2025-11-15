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

// Access PIN validation schema
export const accessPinSchema = z.string()
  .min(6, "PIN must be at least 6 characters")
  .max(50, "PIN must be less than 50 characters")
  .regex(/^(?=.*[A-Za-z])(?=.*[0-9])/, "PIN must contain both letters and numbers")
  .refine(
    pin => !['123456', 'password', '111111', 'qwerty', 'abc123'].includes(pin.toLowerCase()), 
    "PIN is too common"
  );

// Registration number validation schema
export const registrationNumberSchema = z.string()
  .trim()
  .min(3, "Registration number must be at least 3 characters")
  .max(50, "Registration number must be less than 50 characters")
  .regex(/^[A-Z0-9\s\-/]+$/i, "Registration number can only contain letters, numbers, spaces, hyphens, and slashes");

// Admin emails validation schema
export const adminEmailsSchema = z.string()
  .transform(str => 
    str.split(',')
      .map(e => e.trim())
      .filter(Boolean)
  )
  .pipe(
    z.array(z.string().email("Invalid email format"))
      .max(10, "Maximum 10 administrators allowed")
  );
