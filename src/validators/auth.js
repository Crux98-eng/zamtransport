const { z } = require('zod');

const password = z.string().min(12).max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[0-9]/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol.');

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  phoneNumber: z.string().trim().min(5).max(30).optional(),
  password,
  confirmPassword: z.string(),
}).strict().refine((data) => data.password === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

const loginSchema = z.object({ email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()), password: z.string().min(1).max(128) }).strict();
const refreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();
const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password, confirmPassword: z.string() }).strict().refine((data) => data.newPassword === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });
const rejectSchema = z.object({ reason: z.string().trim().min(3).max(1000).optional() }).strict();
const roleSchema = z.object({ role: z.enum(['ADMIN', 'DRIVER', 'COMMUTER']) }).strict();
const statusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) }).strict();
const profileSchema = z.object({ fullName: z.string().trim().min(2).max(150).optional(), phoneNumber: z.string().trim().min(5).max(30).nullable().optional() }).strict();

module.exports = { loginSchema, passwordChangeSchema, profileSchema, refreshSchema, registerSchema, rejectSchema, roleSchema, statusSchema };
