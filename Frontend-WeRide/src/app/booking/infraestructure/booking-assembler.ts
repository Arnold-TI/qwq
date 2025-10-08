import { Booking } from '../domain/model/booking.entity';
import { BookingResponse } from './bookings-response';

// Convierte BookingResponse (infraestructura) a Booking (dominio)
export function toDomainBooking(response: BookingResponse): Booking {
  // Asume que unlockTime es el inicio y calcula endDate con duration
  const startDate = new Date(response.unlockTime);
  const endDate = new Date(startDate.getTime() + response.duration * 60 * 60 * 1000);
  // Mapea el status de la API al status de dominio
  let status: 'pending' | 'confirmed' | 'cancelled' = 'pending';
  if (response.status === 'reserved') status = 'confirmed';
  if (response.status === 'cancelled') status = 'cancelled';
  // Construye la entidad de dominio
  return new Booking(
    response.id,
    response.userId,
    response.vehicleId,
    startDate,
    endDate,
    status
  );
}

// Convierte Booking (dominio) a BookingResponse (infraestructura)
export function toInfraBooking(booking: Booking): BookingResponse {
  let status: 'reserved' | 'cancelled' | 'completed' = 'reserved';
  if (booking.status === 'cancelled') status = 'cancelled';
  if (booking.status === 'confirmed') status = 'reserved';
  // Si tienes lógica para 'completed', agrégala aquí
  return {
    id: booking.id,
    userId: booking.userId,
    vehicleId: booking.vehicleId,
    locationId: '', // Asignar si tienes la info
    unlockTime: booking.startDate.toISOString(),
    duration: (booking.endDate.getTime() - booking.startDate.getTime()) / (60 * 60 * 1000),
    rate: 0, // Asignar si tienes la info
    status,
    createdAt: booking.startDate.toISOString(),
    notifications: {
      smsReminder: false,
      emailConfirmation: false,
      pushNotification: false
    }
  };
}
