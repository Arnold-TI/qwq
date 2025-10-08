// Respuesta de la API para una reserva
export interface BookingResponse {
  id: string;
  vehicleId: string;
  userId: string;
  locationId: string;
  unlockTime: string;
  duration: number;
  rate: number;
  status: 'reserved' | 'cancelled' | 'completed';
  createdAt: string;
  notifications: {
    smsReminder: boolean;
    emailConfirmation: boolean;
    pushNotification: boolean;
  };
}

// Respuesta de la API para listado de reservas
export interface BookingsListResponse {
  bookings: BookingResponse[];
}

