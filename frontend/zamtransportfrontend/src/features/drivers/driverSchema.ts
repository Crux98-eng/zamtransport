import { z } from 'zod'

export const driverRegisterSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(150, 'Full name cannot exceed 150 characters.'),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address.')
      .max(191, 'Email cannot exceed 191 characters.'),
    phoneNumber: z
      .string()
      .trim()
      .max(30, 'Phone number cannot exceed 30 characters.')
      .refine(
        (val) => val === '' || val.length >= 5,
        'Phone number must be at least 5 digits.',
      )
      .optional(),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters.')
      .max(128, 'Password cannot exceed 128 characters.')
      .regex(/[a-z]/, 'Must include at least one lowercase letter.')
      .regex(/[A-Z]/, 'Must include at least one uppercase letter.')
      .regex(/[0-9]/, 'Must include at least one number.')
      .regex(/[^A-Za-z0-9]/, 'Must include at least one symbol (!@#$%^&*).'),
    confirmPassword: z.string().min(1, 'Please confirm the password.'),
    licenceNumber: z
      .string()
      .trim()
      .min(2, 'Licence number must be at least 2 characters.')
      .max(100, 'Licence number cannot exceed 100 characters.'),
    licenceExpiry: z
      .string()
      .min(1, 'Licence expiry date is required.')
      .refine(
        (val) => {
          const date = new Date(val)
          return !isNaN(date.getTime()) && date >= new Date()
        },
        'Licence expiry must be in the future.',
      ),
    address: z
      .string()
      .trim()
      .max(255, 'Address cannot exceed 255 characters.')
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })

export type DriverRegisterFormValues = z.infer<typeof driverRegisterSchema>

export const driverUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters.')
    .max(150, 'Full name cannot exceed 150 characters.'),
  phoneNumber: z
    .string()
    .trim()
    .max(30, 'Phone number cannot exceed 30 characters.')
    .refine(
      (val) => val === '' || val.length >= 5,
      'Phone number must be at least 5 digits.',
    )
    .optional(),
  address: z
    .string()
    .trim()
    .max(255, 'Address cannot exceed 255 characters.')
    .optional(),
  licenceNumber: z
    .string()
    .trim()
    .min(2, 'Licence number must be at least 2 characters.')
    .max(100, 'Licence number cannot exceed 100 characters.'),
  licenceExpiry: z
    .string()
    .min(1, 'Licence expiry date is required.')
    .refine(
      (val) => {
        const date = new Date(val)
        return !isNaN(date.getTime())
      },
      'Enter a valid expiry date.',
    ),
})

export type DriverUpdateFormValues = z.infer<typeof driverUpdateSchema>

export function generateStrongPassword(): string {
  const lowers = 'abcdefghjkmnpqrstuvwxyz'
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const symbols = '!@#$%^&*'
  const all = lowers + uppers + digits + symbols

  let pwd = ''
  pwd += lowers[Math.floor(Math.random() * lowers.length)]
  pwd += uppers[Math.floor(Math.random() * uppers.length)]
  pwd += digits[Math.floor(Math.random() * digits.length)]
  pwd += symbols[Math.floor(Math.random() * symbols.length)]

  for (let i = 0; i < 10; i++) {
    pwd += all[Math.floor(Math.random() * all.length)]
  }

  // Shuffle
  return pwd
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('')
}
