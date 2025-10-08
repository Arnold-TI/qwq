// Respuesta de la API para una ubicación
export interface LocationResponse {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  availableVehicles: number;
}

// Respuesta de la API para listado de ubicaciones
export interface LocationsListResponse {
  locations: LocationResponse[];
}

