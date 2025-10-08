import { BookingResponse, BookingsListResponse } from './bookings-response';

// Servicio simulado para consumir la API de reservas
export class BookingsApiEndpoint {
  // Simulación de datos en memoria
  private bookings: BookingResponse[] = [];

  // Obtener todas las reservas
  async getAll(): Promise<BookingsListResponse> {
    return { bookings: this.bookings };
  }

  // Crear una nueva reserva
  async create(booking: Omit<BookingResponse, 'id' | 'createdAt'>): Promise<BookingResponse> {
    const newBooking: BookingResponse = {
      ...booking,
      id: Math.random().toString(36).substring(2),
      createdAt: new Date().toISOString(),
    };
    this.bookings.push(newBooking);
    return newBooking;
  }

  // Obtener una reserva por ID
  async getById(id: string): Promise<BookingResponse | undefined> {
    return this.bookings.find(b => b.id === id);
  }
}

