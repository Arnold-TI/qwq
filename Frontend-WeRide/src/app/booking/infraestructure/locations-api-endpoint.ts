import { LocationResponse, LocationsListResponse } from './locations-response';

// Servicio simulado para consumir la API de ubicaciones
export class LocationsApiEndpoint {
  private locations: LocationResponse[] = [];

  // Obtener todas las ubicaciones
  async getAll(): Promise<LocationsListResponse> {
    return { locations: this.locations };
  }

  // Crear una nueva ubicación
  async create(location: Omit<LocationResponse, 'id'>): Promise<LocationResponse> {
    const newLocation: LocationResponse = {
      ...location,
      id: Math.random().toString(36).substring(2)
    };
    this.locations.push(newLocation);
    return newLocation;
  }

  // Obtener una ubicación por ID
  async getById(id: string): Promise<LocationResponse | undefined> {
    return this.locations.find(l => l.id === id);
  }
}

