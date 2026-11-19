const { z } = require('zod');

const strongPassword = z.string().min(12).max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[0-9]/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol.');

const driverCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  phoneNumber: z.string().trim().min(5).max(30).optional(),
  password: strongPassword,
  confirmPassword: z.string(),
  licenceNumber: z.string().trim().min(2).max(100),
  licenceExpiry: z.coerce.date(),
  address: z.string().trim().max(255).optional(),
}).strict().refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })
  .refine((value) => value.licenceExpiry >= new Date(), { path: ['licenceExpiry'], message: 'Licence expiry must be in the future.' });

const driverUpdateSchema = z.object({ fullName: z.string().trim().min(2).max(150).optional(), phoneNumber: z.string().trim().min(5).max(30).nullable().optional(), address: z.string().trim().max(255).nullable().optional(), licenceNumber: z.string().trim().min(2).max(100).optional(), licenceExpiry: z.coerce.date().optional() }).strict();
const driverStatusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) }).strict();

const vehicleSchema = z.object({ registrationNumber: z.string().trim().min(2).max(50), vehicleName: z.string().trim().max(100).nullable().optional(), manufacturer: z.string().trim().max(100).nullable().optional(), model: z.string().trim().max(100).nullable().optional(), vehicleType: z.string().trim().min(2).max(50), capacity: z.coerce.number().int().min(1).max(1000), manufactureYear: z.coerce.number().int().min(1886).max(new Date().getFullYear() + 1).nullable().optional(), description: z.string().max(5000).nullable().optional() }).strict();
const vehiclePatchSchema = vehicleSchema.partial();
const vehicleStatusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']) }).strict();

const routeFields = { name: z.string().trim().min(2).max(150), routeCode: z.string().trim().max(50).nullable().optional(), originStopId: z.coerce.number().int().positive(), destinationStopId: z.coerce.number().int().positive(), description: z.string().max(5000).nullable().optional(), distanceKm: z.coerce.number().nonnegative().max(99999999).nullable().optional(), estimatedDuration: z.coerce.number().int().positive().nullable().optional() };
const routeSchema = z.object(routeFields).strict().refine((value) => value.originStopId !== value.destinationStopId, { path: ['destinationStopId'], message: 'Origin and destination terminals must be different.' });
const routePatchSchema = z.object(routeFields).partial().strict().refine((value) => {
  const hasOrigin = value.originStopId !== undefined;
  const hasDestination = value.destinationStopId !== undefined;
  return hasOrigin === hasDestination && (!hasOrigin || value.originStopId !== value.destinationStopId);
}, { path: ['destinationStopId'], message: 'Select different origin and destination terminals together.' });
const routeStatusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }).strict();
const stopSchema = z.object({ name: z.string().trim().min(2).max(150), description: z.string().max(5000).nullable().optional(), latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180) }).strict();
const stopPatchSchema = stopSchema.partial();
const routeStopSchema = z.object({ stopId: z.coerce.number().int().positive(), sequence: z.coerce.number().int().positive(), estimatedMinutesFromStart: z.coerce.number().int().nonnegative().nullable().optional() }).strict();
const reorderSchema = z.object({ stops: z.array(z.object({ stopId: z.coerce.number().int().positive(), sequence: z.coerce.number().int().positive() }).strict()).min(1) }).strict();
const assignmentSchema = z.object({ vehicleId: z.coerce.number().int().positive(), driverId: z.coerce.number().int().positive(), assignedAt: z.coerce.date().optional() }).strict();

module.exports = { assignmentSchema, driverCreateSchema, driverStatusSchema, driverUpdateSchema, reorderSchema, routePatchSchema, routeSchema, routeStatusSchema, routeStopSchema, stopPatchSchema, stopSchema, vehiclePatchSchema, vehicleSchema, vehicleStatusSchema };
