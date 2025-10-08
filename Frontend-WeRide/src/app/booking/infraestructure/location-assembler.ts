import { Location } from '../domain/model/location.entity';
import { LocationResponse } from './locations-response';

// Convierte LocationResponse (infraestructura) a Location (dominio)
export function toDomainLocation(response: LocationResponse): Location {
  return new Location(
    response.id,
    response.name,
    response.address,
    { lat: response.latitude, lng: response.longitude }
  );
}

// Convierte Location (dominio) a LocationResponse (infraestructura)
export function toInfraLocation(location: Location): LocationResponse {
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    latitude: location.coordinates.lat,
    longitude: location.coordinates.lng,
    availableVehicles: 0 // Asignar si tienes la info
  };
}

