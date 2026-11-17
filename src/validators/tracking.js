const { z } = require('zod');

const simulationStartSchema = z.object({ tripId: z.coerce.number().int().positive() }).strict();
module.exports = { simulationStartSchema };
