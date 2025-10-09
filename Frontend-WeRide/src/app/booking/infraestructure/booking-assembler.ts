import { Booking, NotificationPreferences } from '../domain/model/booking.entity';
import { BookingResponse } from './bookings-response';

// ✅ Convierte BookingResponse (infraestructura) a Booking (dominio)
export function toDomainBooking(response: BookingResponse): Booking {
  // Calcula fechas de inicio y fin
  const scheduledStartTime = new Date(response.unlockTime);
  const scheduledEndTime = new Date(scheduledStartTime.getTime() + response.duration * 60 * 60 * 1000);

  // Mapea el status de la API al status de dominio
  let status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'expired' = 'pending';
  switch (response.status) {
    case 'reserved':
      status = 'confirmed';
      break;
    case 'cancelled':
      status = 'cancelled';
      break;
    case 'completed':
      status = 'completed';
      break;
    default:
      status = 'pending';
  }

  // Mapea las notificaciones desde la respuesta
  const notificationPreferences: NotificationPreferences = {
    startNotification: response.notifications?.pushNotification ?? false,
    endingNotification: true, // Valor por defecto
    expirationNotification: false,
    methods: ['push'], // Valor por defecto
    advanceMinutes: 10 // Valor por defecto
  };

  // ✅ CORRECCIÓN: Crear objeto literal (interfaz) en lugar de usar constructor
  return {
    id: response.id,
    userId: response.userId,
    vehicleId: response.vehicleId,
    locationId: response.locationId || '', // Usar el locationId del response o vacío
    status,

    // Tiempos
    createdAt: new Date(response.createdAt),
    reservedAt: new Date(response.createdAt), // Usar createdAt como reservedAt
    scheduledStartTime, // ✅ Usar nombres correctos de propiedades
    scheduledEndTime,   // ✅ Usar nombres correctos de propiedades
    actualStartTime: undefined, // No disponible en el response
    actualEndTime: undefined,   // No disponible en el response

    // Timer y extensiones
    timer: undefined, // Se asignaría después si existe
    allowExtensions: true, // Valor por defecto
    maxExtensionMinutes: 120, // Valor por defecto

    // Notificaciones
    notificationPreferences,

    // Costos
    estimatedCost: response.rate * response.duration,
    finalCost: undefined, // Se calcularía al completar
    extensions: [], // Array vacío inicial

    // Desbloqueo
    unlockMethod: undefined, // Se asignaría cuando se desbloquee
    unlockStatus: 'pending' // Estado inicial
  };
}

// ✅ Convierte Booking (dominio) a BookingResponse (infraestructura)
export function toInfraBooking(booking: Booking): BookingResponse {
  // Mapea el status de dominio al status de la API
  let status: 'reserved' | 'cancelled' | 'completed' = 'reserved';
  switch (booking.status) {
    case 'cancelled':
    case 'expired':
      status = 'cancelled';
      break;
    case 'completed':
      status = 'completed';
      break;
    default:
      status = 'reserved';
  }

  // Calcula duración en horas
  const duration = (booking.scheduledEndTime.getTime() - booking.scheduledStartTime.getTime()) / (60 * 60 * 1000);

  return {
    id: booking.id,
    userId: booking.userId,
    vehicleId: booking.vehicleId,
    locationId: booking.locationId,
    unlockTime: booking.scheduledStartTime.toISOString(), // ✅ Usar nombres correctos
    duration,
    rate: booking.estimatedCost / duration, // Calcular rate desde el costo estimado
    status,
    createdAt: booking.createdAt.toISOString(),
    notifications: {
      smsReminder: booking.notificationPreferences.methods.includes('sms'),
      emailConfirmation: booking.notificationPreferences.methods.includes('email'),
      pushNotification: booking.notificationPreferences.methods.includes('push')
    }
  };
}

// ✅ FUNCIÓN ADICIONAL: Crear booking vacío con valores por defecto
export function createEmptyBooking(): Partial<Booking> {
  return {
    status: 'pending',
    allowExtensions: true,
    maxExtensionMinutes: 120,
    extensions: [],
    unlockStatus: 'pending',
    notificationPreferences: {
      startNotification: true,
      endingNotification: true,
      expirationNotification: false,
      methods: ['push'],
      advanceMinutes: 10
    }
  };
}

// ✅ FUNCIÓN ADICIONAL: Validar si un booking es válido
export function isValidBooking(booking: Partial<Booking>): booking is Booking {
  return !!(
    booking.id &&
    booking.userId &&
    booking.vehicleId &&
    booking.locationId &&
    booking.status &&
    booking.scheduledStartTime &&
    booking.scheduledEndTime &&
    booking.createdAt &&
    booking.reservedAt &&
    booking.notificationPreferences
  );
}
