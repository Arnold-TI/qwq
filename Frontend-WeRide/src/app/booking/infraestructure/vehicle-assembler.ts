import { VehicleResponse } from './vehicle-response';
// Asumo la entidad Vehicle en dominio:
import { Vehicle } from '../domain/model/vehicle.entity';

// Convierte VehicleResponse (infraestructura) a Vehicle (dominio)
export function toDomainVehicle(response: VehicleResponse): Vehicle {
  return new Vehicle(
    response.id,
    response.brand,
    response.model,
    response.year,
    response.battery,
    response.location,
    response.status
  );
}

// Convierte Vehicle (dominio) a VehicleResponse (infraestructura)
export function toInfraVehicle(vehicle: Vehicle): VehicleResponse {
  return {
    id: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    battery: vehicle.battery,
    location: vehicle.location,
    status: vehicle.status
  };
}

