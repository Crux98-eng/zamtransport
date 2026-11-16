const { z } = require('zod');

const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const tripStatuses = ['SCHEDULED', 'BOARDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED'];
const date = z.coerce.date();
const dateOnly = date.refine((value) => !Number.isNaN(value.getTime()), 'A valid date is required.');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Time must use HH:mm or HH:mm:ss format.');
const id = z.coerce.number().int().positive();

const scheduleFields = {
  routeId: id,
  description: z.string().trim().max(1000).nullable().optional(),
  departureTime: time,
  estimatedDuration: z.coerce.number().int().positive().max(1440),
  effectiveFrom: dateOnly,
  effectiveUntil: dateOnly.nullable().optional(),
  days: z.array(z.enum(days)).min(1).max(7),
};

const uniqueDays = (value) => new Set(value.days).size === value.days.length;
const scheduleCreateSchema = z.object(scheduleFields).strict().refine(uniqueDays, { path: ['days'], message: 'Operating days must not contain duplicates.' }).refine((value) => !value.effectiveUntil || value.effectiveUntil >= value.effectiveFrom, { path: ['effectiveUntil'], message: 'Effective end date must be on or after the start date.' });
const schedulePatchSchema = z.object({ ...scheduleFields, status: z.enum(['ACTIVE', 'INACTIVE']) }).partial().strict().refine((value) => !value.days || uniqueDays(value), { path: ['days'], message: 'Operating days must not contain duplicates.' }).refine((value) => !value.effectiveUntil || !value.effectiveFrom || value.effectiveUntil >= value.effectiveFrom, { path: ['effectiveUntil'], message: 'Effective end date must be on or after the start date.' });
const scheduleStatusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }).strict();

const paginationQuery = z.object({ page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(), search: z.string().trim().max(100).optional(), status: z.enum(['ACTIVE', 'INACTIVE']).optional() }).passthrough();
const tripListQuery = paginationQuery.extend({ routeId: id.optional(), scheduleId: id.optional(), driverId: id.optional(), vehicleId: id.optional(), tripCode: z.string().trim().max(50).optional(), tripStatus: z.enum(tripStatuses).optional(), from: date.optional(), to: date.optional(), upcoming: z.enum(['true', 'false']).optional() });

const generateTripsSchema = z.object({ scheduleId: id.optional(), startDate: dateOnly, endDate: dateOnly }).strict().refine((value) => value.endDate >= value.startDate, { path: ['endDate'], message: 'End date must be on or after start date.' });
const tripCreateSchema = z.object({ scheduleId: id, routeId: id.optional(), tripCode: z.string().trim().max(50).nullable().optional(), vehicleId: id.optional(), driverId: id.optional(), scheduledDeparture: date, scheduledArrival: date }).strict().refine((value) => value.scheduledArrival > value.scheduledDeparture, { path: ['scheduledArrival'], message: 'Scheduled arrival must be after departure.' });
const tripPatchSchema = z.object({ tripCode: z.string().trim().max(50).nullable().optional(), scheduledDeparture: date.optional(), scheduledArrival: date.optional(), delayReason: z.string().trim().max(1000).nullable().optional(), revisedDeparture: date.nullable().optional(), revisedArrival: date.nullable().optional() }).strict();
const tripStatusSchema = z.object({ status: z.enum(tripStatuses), reason: z.string().trim().max(1000).optional(), revisedDeparture: date.optional(), revisedArrival: date.optional() }).strict();
const tripAssignmentSchema = z.object({ driverId: id, vehicleId: id }).strict();
const tripCancelSchema = z.object({ reason: z.string().trim().min(2).max(1000) }).strict();

module.exports = { generateTripsSchema, paginationQuery, scheduleCreateSchema, schedulePatchSchema, scheduleStatusSchema, tripAssignmentSchema, tripCancelSchema, tripCreateSchema, tripListQuery, tripPatchSchema, tripStatusSchema, days, tripStatuses };
