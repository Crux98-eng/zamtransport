export type ApiEnvelope<T> = { success: true; message?: string; data: T }
export type UserRole = 'ADMIN' | 'DRIVER' | 'COMMUTER'
export type User = { id: number; firstName: string; lastName: string; email: string; role: UserRole; status: string }
export type AuthTokens = { accessToken: string; refreshToken: string }
