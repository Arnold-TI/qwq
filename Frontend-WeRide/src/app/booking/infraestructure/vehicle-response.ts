// Respuesta de la API para un vehículo
export interface VehicleResponse {
  id: string;
  brand: string;
  model: string;
  year: number;
  battery: number;
  location: string;
  status: 'available' | 'reserved' | 'maintenance';
}

// Respuesta de la API para listado de vehículos
export interface VehiclesListResponse {
  vehicles: VehicleResponse[];
}

