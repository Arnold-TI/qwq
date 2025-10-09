export interface UnlockRequest {
  id: string;
  bookingId: string;
  vehicleId: string;
  userId: string;
  method: 'qr_code' | 'app_button' | 'scheduled';
  status: 'pending' | 'processing' | 'success' | 'failed' | 'expired' | 'cancelled';

  // Tiempos
  requestedAt: Date;
  scheduledFor?: Date;
  processedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;

  // Datos específicos del método
  qrCode?: string;
  qrScannedAt?: Date;
  appButtonPressed?: boolean;

  // Ubicación y validación
  requestLocation: LocationCoordinates;
  vehicleLocation: LocationCoordinates;
  distanceValidation: boolean;
  maxDistanceMeters: number;

  // Manejo de errores y reintentos
  failureReason?: string;
  errorCode?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;

  // Estado del vehículo
  vehicleBatteryLevel?: number;
  vehicleConnectionStatus: 'online' | 'offline' | 'weak';

  // Logs para auditoría
  attemptLogs: UnlockAttemptLog[];
}

export interface UnlockAttemptLog {
  attemptNumber: number;
  timestamp: Date;
  method: string;
  result: 'success' | 'failure';
  errorDetails?: string;
  responseTime: number; // milliseconds
}

export interface LocationCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: Date;
}
