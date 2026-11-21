// Singleton Socket.IO connection used for live dashboard and vehicle updates.
import { io, type Socket } from 'socket.io-client'
import { env } from '@/lib/env'
import { getAccessToken } from '@/stores/auth-store'
let socket: Socket | null = null
export function connectSocket() { const token = getAccessToken(); if (!token) return null; socket ??= io(env.socketUrl, { auth: { token }, autoConnect: false }); if (!socket.connected) socket.connect(); return socket }
export function disconnectSocket() { socket?.disconnect(); socket = null }
