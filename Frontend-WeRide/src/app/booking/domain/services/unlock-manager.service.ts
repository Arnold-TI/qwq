import { Observable } from 'rxjs';
import { UnlockRequest } from '../model/unlockRequest.entity';

export interface UnlockResult {
  success: boolean;
  unlockRequestId: string;
  message: string;
  errorCode?: string;
  estimatedRetryTime?: Date;
}

export abstract class UnlockManagerService {
  // Métodos de desbloqueo
  abstract unlockWithQR(qrData: string, userId: string, location: any): Observable<UnlockResult>;
  abstract unlockFromApp(bookingId: string, userId: string): Observable<UnlockResult>;
  abstract scheduleUnlock(bookingId: string, scheduledTime: Date): Observable<UnlockResult>;

  // Estado del desbloqueo
  abstract getUnlockStatus(unlockRequestId: string): Observable<UnlockRequest>;
  abstract isVehicleUnlocked(vehicleId: string): Observable<boolean>;
  abstract getVehicleLockStatus(vehicleId: string): Observable<any>;

  // Validaciones previas al desbloqueo
  abstract validateUnlockConditions(bookingId: string, method: string): Observable<boolean>;
  abstract checkVehicleAvailability(vehicleId: string): Observable<boolean>;
  abstract validateUserDistance(userId: string, vehicleId: string): Observable<boolean>;

  // Manejo de errores y reintentos
  abstract retryUnlockRequest(unlockRequestId: string): Observable<UnlockResult>;
  abstract cancelUnlockRequest(unlockRequestId: string): Observable<boolean>;
  abstract getFailedUnlockRequests(userId: string): Observable<UnlockRequest[]>;
}
