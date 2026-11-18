import { z } from 'zod'

const currentYear = new Date().getFullYear()

export const vehicleFormSchema = z.object({
  registrationNumber: z
    .string()
    .trim()
    .min(2, 'Registration number must be at least 2 characters.')
    .max(50, 'Registration number cannot exceed 50 characters.'),
  vehicleType: z
    .string()
    .trim()
    .min(2, 'Vehicle type must be at least 2 characters.')
    .max(50, 'Vehicle type cannot exceed 50 characters.'),
  capacity: z
    .number()
    .int('Capacity must be a whole number.')
    .min(1, 'Capacity must be at least 1 passenger seat.')
    .max(1000, 'Capacity cannot exceed 1000 seats.'),
  vehicleName: z
    .string()
    .trim()
    .max(100, 'Vehicle name cannot exceed 100 characters.')
    .optional(),
  manufacturer: z
    .string()
    .trim()
    .max(100, 'Manufacturer cannot exceed 100 characters.')
    .optional(),
  model: z
    .string()
    .trim()
    .max(100, 'Model cannot exceed 100 characters.')
    .optional(),
  manufactureYear: z
    .number()
    .int('Year must be a whole number.')
    .min(1886, 'Year must be 1886 or later.')
    .max(currentYear + 1, `Year cannot exceed ${currentYear + 1}.`)
    .nullable()
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, 'Description cannot exceed 5000 characters.')
    .optional(),
})

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>

export function sanitizeVehiclePayload(values: VehicleFormValues) {
  return {
    registrationNumber: values.registrationNumber.trim().toUpperCase(),
    vehicleType: values.vehicleType.trim().toUpperCase(),
    capacity: Number(values.capacity),
    vehicleName: values.vehicleName?.trim() || null,
    manufacturer: values.manufacturer?.trim() || null,
    model: values.model?.trim() || null,
    manufactureYear:
      values.manufactureYear !== null &&
      values.manufactureYear !== undefined &&
      !isNaN(values.manufactureYear)
        ? Number(values.manufactureYear)
        : null,
    description: values.description?.trim() || null,
  }
}
