// Respuesta de la API para una solicitud de desbloqueo
export interface UnlockRequestResponse {
  id: string;
  userId: string;
  vehicleId: string;
  requestedAt: string;
  unlockTime: string;
  status: 'pending' | 'unlocked' | 'failed';
}

// Respuesta de la API para listado de solicitudes de desbloqueo
export interface UnlockRequestsListResponse {
  unlockRequests: UnlockRequestResponse[];
}

