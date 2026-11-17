const { z } = require('zod');
const types = ['USER_APPROVAL', 'USER_REJECTION', 'TRIP_ASSIGNMENT', 'TRIP_BOARDING', 'TRIP_DEPARTURE', 'TRIP_DELAY', 'TRIP_CANCELLATION', 'TRIP_COMPLETION', 'VEHICLE_MAINTENANCE', 'SYSTEM_ALERT', 'GENERAL'];
const preferenceSchema = z.object({ inAppEnabled: z.boolean().optional(), emailEnabled: z.boolean().optional(), mutedTypes: z.array(z.enum(types)).max(types.length).optional() }).strict().refine((value) => Object.keys(value).length > 0, 'At least one preference is required.');
module.exports = { preferenceSchema, types };
