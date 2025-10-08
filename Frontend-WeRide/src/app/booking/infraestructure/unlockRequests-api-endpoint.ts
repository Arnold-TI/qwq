import { UnlockRequestResponse, UnlockRequestsListResponse } from './unlockRequests-response';

// Servicio simulado para consumir la API de solicitudes de desbloqueo
export class UnlockRequestsApiEndpoint {
  private unlockRequests: UnlockRequestResponse[] = [];

  // Obtener todas las solicitudes de desbloqueo
  async getAll(): Promise<UnlockRequestsListResponse> {
    return { unlockRequests: this.unlockRequests };
  }

  // Crear una nueva solicitud de desbloqueo
  async create(request: Omit<UnlockRequestResponse, 'id' | 'requestedAt'>): Promise<UnlockRequestResponse> {
    const newRequest: UnlockRequestResponse = {
      ...request,
      id: Math.random().toString(36).substring(2),
      requestedAt: new Date().toISOString()
    };
    this.unlockRequests.push(newRequest);
    return newRequest;
  }

  // Obtener una solicitud por ID
  async getById(id: string): Promise<UnlockRequestResponse | undefined> {
    return this.unlockRequests.find(r => r.id === id);
  }
}

