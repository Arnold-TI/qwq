// Expandir la entidad existente
export interface Booking {
  id: string;
  userId: string;
  vehicleId: string;
  locationId: string;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'expired';

  // Tiempos
  createdAt: Date;
  reservedAt: Date;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;

  // Timer y extensiones
  timer?: ReservationTimer;
  allowExtensions: boolean;
  maxExtensionMinutes: number;

  // Notificaciones
  notificationPreferences: NotificationPreferences;

  // Costos
  estimatedCost: number;
  finalCost?: number;
  extensions: BookingExtension[];

  // Desbloqueo
  unlockMethod?: 'qr' | 'app' | 'scheduled';
  unlockStatus?: 'pending' | 'unlocked' | 'failed';
}

export interface NotificationPreferences {
  startNotification: boolean;
  endingNotification: boolean;
  expirationNotification: boolean;
  methods: ('push' | 'sms' | 'email')[];
  advanceMinutes: number; // Minutos antes del fin para notificar
}

export interface BookingExtension {
  id: string;
  requestedAt: Date;
  additionalMinutes: number;
  cost: number;
  approved: boolean;
  paymentProcessed: boolean;
}
