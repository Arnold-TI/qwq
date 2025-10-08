import { VehicleResponse, VehiclesListResponse } from './vehicle-response';

// Servicio simulado para consumir la API de vehículos
export class VehiclesApiEndpoint {
  private vehicles: VehicleResponse[] = [];

  // Obtener todos los vehículos
  async getAll(): Promise<VehiclesListResponse> {
    return { vehicles: this.vehicles };
  }

  // Crear un nuevo vehículo
  async create(vehicle: Omit<VehicleResponse, 'id'>): Promise<VehicleResponse> {
    const newVehicle: VehicleResponse = {
      ...vehicle,
      id: Math.random().toString(36).substring(2)
    };
    this.vehicles.push(newVehicle);
    return newVehicle;
  }

  // Obtener un vehículo por ID
  async getById(id: string): Promise<VehicleResponse | undefined> {
    return this.vehicles.find(v => v.id === id);
  }
}

