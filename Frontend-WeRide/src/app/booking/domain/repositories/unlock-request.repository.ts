import { Observable } from 'rxjs';
import { UnlockRequest } from '../model/unlockRequest.entity';

export abstract class UnlockRequestRepository {
  // Operaciones básicas
  abstract createUnlockRequest(request: UnlockRequest): Observable<UnlockRequest>;
  abstract getUnlockRequestById(id: string): Observable<UnlockRequest>;
  abstract updateUnlockRequest(request: UnlockRequest): Observable<boolean>;
  abstract getUnlockRequestsByBookingId(bookingId: string): Observable<UnlockRequest[]>;

  // Consultas de estado
  abstract getPendingUnlockRequests(): Observable<UnlockRequest[]>;
  abstract getFailedUnlockRequests(): Observable<UnlockRequest[]>;
  abstract getUnlockRequestsByStatus(status: string): Observable<UnlockRequest[]>;

  // Consultas por método
  abstract getQRUnlockRequests(vehicleId: string): Observable<UnlockRequest[]>;
  abstract getScheduledUnlockRequests(fromTime: Date, toTime: Date): Observable<UnlockRequest[]>;

  // Operaciones de reintento
  abstract markForRetry(requestId: string, nextRetryTime: Date): Observable<boolean>;
  abstract getRequestsReadyForRetry(): Observable<UnlockRequest[]>;

  // Validaciones
  abstract validateQRCode(qrCode: string, vehicleId: string): Observable<boolean>;
  abstract checkDistanceValidation(requestLocation: any, vehicleLocation: any): Observable<boolean>;
}
