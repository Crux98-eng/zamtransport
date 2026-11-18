import { api } from '@/services/api'
import type { ApiEnvelope } from '@/types/api'
import type { LiveVehicleLocation, VehicleEta } from './liveLocation.types'

export const trackingService = {
  async listLiveVehicles() {
    const response = await api.get<ApiEnvelope<{ vehicles: LiveVehicleLocation[] }>>('/tracking/vehicles')
    return response.data.data.vehicles
  },

  async getVehicleEta(vehicleId: number) {
    const response = await api.get<ApiEnvelope<{ eta: VehicleEta }>>(`/tracking/vehicles/${vehicleId}/eta`)
    return response.data.data.eta
  },
}
