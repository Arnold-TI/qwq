import { UnlockRequest } from '../domain/model/unlockRequest.entity';
import { UnlockRequestResponse } from './unlockRequests-response';

// Convierte UnlockRequestResponse (infraestructura) a UnlockRequest (dominio)
export function toDomainUnlockRequest(response: UnlockRequestResponse): UnlockRequest {
  return new UnlockRequest(
    response.id,
    response.userId,
    response.vehicleId,
    new Date(response.requestedAt),
    new Date(response.unlockTime),
    response.status
  );
}

// Convierte UnlockRequest (dominio) a UnlockRequestResponse (infraestructura)
export function toInfraUnlockRequest(request: UnlockRequest): UnlockRequestResponse {
  return {
    id: request.id,
    userId: request.userId,
    vehicleId: request.vehicleId,
    requestedAt: request.requestedAt.toISOString(),
    unlockTime: request.unlockTime.toISOString(),
    status: request.status
  };
}

