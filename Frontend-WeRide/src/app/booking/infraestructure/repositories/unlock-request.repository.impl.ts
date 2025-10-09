import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { UnlockRequestRepository } from '../../domain/repositories/unlock-request.repository';
import { UnlockRequest } from '../../domain/model/unlockRequest.entity';

@Injectable({
  providedIn: 'root'
})
export class UnlockRequestRepositoryImpl extends UnlockRequestRepository {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {
    super();
  }

  createUnlockRequest(request: UnlockRequest): Observable<UnlockRequest> {
    return this.http.post<UnlockRequest>(`${this.API_URL}/unlock-requests`, request).pipe(
      catchError(this.handleError)
    );
  }

  getUnlockRequestById(id: string): Observable<UnlockRequest> {
    return this.http.get<UnlockRequest>(`${this.API_URL}/unlock-requests/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  updateUnlockRequest(request: UnlockRequest): Observable<boolean> {
    return this.http.put(`${this.API_URL}/unlock-requests/${request.id}`, request).pipe(
      map(() => true),
      catchError(this.handleError)
    );
  }

  getUnlockRequestsByBookingId(bookingId: string): Observable<UnlockRequest[]> {
    return this.http.get<UnlockRequest[]>(`${this.API_URL}/unlock-requests?bookingId=${bookingId}`).pipe(
      catchError(this.handleError)
    );
  }

  getPendingUnlockRequests(): Observable<UnlockRequest[]> {
    return this.http.get<UnlockRequest[]>(`${this.API_URL}/unlock-requests?status=pending`).pipe(
      catchError(this.handleError)
    );
  }

  getFailedUnlockRequests(): Observable<UnlockRequest[]> {
    return this.http.get<UnlockRequest[]>(`${this.API_URL}/unlock-requests?status=failed`).pipe(
      catchError(this.handleError)
    );
  }

  getUnlockRequestsByStatus(status: string): Observable<UnlockRequest[]> {
    return this.http.get<UnlockRequest[]>(`${this.API_URL}/unlock-requests?status=${status}`).pipe(
      catchError(this.handleError)
    );
  }

  getQRUnlockRequests(vehicleId: string): Observable<UnlockRequest[]> {
    return this.http.get<UnlockRequest[]>(`${this.API_URL}/unlock-requests?vehicleId=${vehicleId}&method=qr_code`).pipe(
      catchError(this.handleError)
    );
  }

  getScheduledUnlockRequests(fromTime: Date, toTime: Date): Observable<UnlockRequest[]> {
    return this.http.get<UnlockRequest[]>(`${this.API_URL}/unlock-requests?method=scheduled`).pipe(
      map(requests => requests.filter(req => {
        if (!req.scheduledFor) return false;
        const scheduledTime = new Date(req.scheduledFor);
        return scheduledTime >= fromTime && scheduledTime <= toTime;
      })),
      catchError(this.handleError)
    );
  }

  markForRetry(requestId: string, nextRetryTime: Date): Observable<boolean> {
    return this.getUnlockRequestById(requestId).pipe(
      switchMap(request => {
        const updatedRequest = {
          ...request,
          nextRetryAt: nextRetryTime.toISOString(),
          retryCount: request.retryCount + 1
        };
        return this.updateUnlockRequest(updatedRequest);
      })
    );
  }

  getRequestsReadyForRetry(): Observable<UnlockRequest[]> {
    return this.getFailedUnlockRequests().pipe(
      map(requests => requests.filter(req => {
        if (!req.nextRetryAt) return false;
        const retryTime = new Date(req.nextRetryAt);
        return retryTime <= new Date() && req.retryCount < req.maxRetries;
      }))
    );
  }

  validateQRCode(qrCode: string, vehicleId: string): Observable<boolean> {
    // Simulación de validación - en producción sería una llamada al backend
    return of(qrCode.includes(vehicleId));
  }

  checkDistanceValidation(requestLocation: any, vehicleLocation: any): Observable<boolean> {
    // Simulación de validación de distancia
    const distance = this.calculateDistance(requestLocation, vehicleLocation);
    return of(distance <= 50); // 50 metros máximo
  }

  private calculateDistance(loc1: any, loc2: any): number {
    // Fórmula simplificada de distancia euclidiana
    const deltaLat = loc2.lat - loc1.lat;
    const deltaLng = loc2.lng - loc1.lng;
    return Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng) * 111000; // Aproximación en metros
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'Error en unlock request';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 400:
          errorMessage = 'Solicitud de desbloqueo inválida';
          break;
        case 401:
          errorMessage = 'No autorizado para desbloquear';
          break;
        case 404:
          errorMessage = 'Solicitud de desbloqueo no encontrada';
          break;
        case 409:
          errorMessage = 'Conflicto: vehículo ya desbloqueado';
          break;
        case 500:
          errorMessage = 'Error del servidor en desbloqueo';
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  };
}
