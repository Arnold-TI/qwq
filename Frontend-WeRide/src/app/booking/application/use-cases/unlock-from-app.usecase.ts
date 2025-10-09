import { Injectable } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { UnlockRequestRepository } from '../../domain/repositories/unlock-request.repository';
import { UnlockManagerService, UnlockResult } from '../../domain/services/unlock-manager.service';
import { UnlockRequest } from '../../domain/model/unlockRequest.entity';

export interface UnlockFromAppRequest {
  bookingId: string;
  userId: string;
  userLocation?: {
    lat: number;
    lng: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class UnlockFromAppUseCase {
  constructor(
    private bookingRepository: BookingRepository,
    private unlockRequestRepository: UnlockRequestRepository,
    private unlockManagerService: UnlockManagerService
  ) {}

  execute(request: UnlockFromAppRequest): Observable<UnlockResult> {
    return this.validateUnlockRequest(request).pipe(
      switchMap(booking => this.createUnlockRequest(request, booking)),
      switchMap(unlockRequest => this.processAppUnlock(unlockRequest)),
      catchError(error => this.handleUnlockError(error))
    );
  }

  private validateUnlockRequest(request: UnlockFromAppRequest): Observable<any> {
    return this.bookingRepository.getBookingById(request.bookingId).pipe(
      switchMap(booking => {
        // Validaciones específicas US-20
        if (!booking) {
          return throwError(() => new Error('Reserva no encontrada'));
        }

        if (booking.userId !== request.userId) {
          return throwError(() => new Error('No autorizado para esta reserva'));
        }

        if (booking.status !== 'confirmed' && booking.status !== 'active') {
          return throwError(() => new Error('La reserva no está en estado válido para desbloqueo'));
        }

        // Verificar si ya hay un unlock request activo
        return this.unlockRequestRepository.getUnlockRequestsByBookingId(booking.id).pipe(
          map(unlockRequests => {
            const activeRequest = unlockRequests.find(req =>
              req.status === 'pending' || req.status === 'processing'
            );

            if (activeRequest) {
              throw new Error('Ya hay una solicitud de desbloqueo en proceso');
            }

            return booking;
          })
        );
      })
    );
  }

  private createUnlockRequest(request: UnlockFromAppRequest, booking: any): Observable<UnlockRequest> {
    const unlockRequest: UnlockRequest = {
      id: this.generateUnlockRequestId(),
      bookingId: request.bookingId,
      vehicleId: booking.vehicleId,
      userId: request.userId,
      method: 'app_button',
      status: 'pending',
      requestedAt: new Date(),
      appButtonPressed: true,
      requestLocation: request.userLocation || { lat: 0, lng: 0 },
      vehicleLocation: { lat: 0, lng: 0 }, // Se obtendría del servicio
      distanceValidation: false,
      maxDistanceMeters: 100, // Más permisivo para app
      retryCount: 0,
      maxRetries: 3,
      vehicleConnectionStatus: 'online',
      attemptLogs: [{
        attemptNumber: 1,
        timestamp: new Date(),
        method: 'app_button',
        result: 'success',
        responseTime: 0
      }]
    };

    return this.unlockRequestRepository.createUnlockRequest(unlockRequest);
  }

  private processAppUnlock(unlockRequest: UnlockRequest): Observable<UnlockResult> {
    return this.unlockManagerService.unlockFromApp(
      unlockRequest.bookingId,
      unlockRequest.userId
    ).pipe(
      switchMap(result => {
        // Actualizar el unlock request con el resultado
        const updatedRequest = {
          ...unlockRequest,
          status: result.success ? 'success' : 'failed',
          completedAt: result.success ? new Date() : undefined,
          failureReason: result.success ? undefined : result.message,
          errorCode: result.errorCode
        };

        return this.unlockRequestRepository.updateUnlockRequest(updatedRequest).pipe(
          map(() => result)
        );
      })
    );
  }

  private generateUnlockRequestId(): string {
    return 'unlock-app-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
  }

  private handleUnlockError(error: any): Observable<UnlockResult> {
    let message = 'Error al desbloquear desde la aplicación';
    let errorCode = 'APP_UNLOCK_ERROR';

    if (error.message.includes('no encontrada')) {
      message = 'Reserva no encontrada';
      errorCode = 'BOOKING_NOT_FOUND';
    } else if (error.message.includes('autorizado')) {
      message = 'No tienes autorización para esta reserva';
      errorCode = 'UNAUTHORIZED';
    } else if (error.message.includes('estado válido')) {
      message = 'La reserva no está en estado válido para desbloqueo';
      errorCode = 'INVALID_BOOKING_STATUS';
    } else if (error.message.includes('en proceso')) {
      message = 'Ya hay una solicitud de desbloqueo en proceso';
      errorCode = 'UNLOCK_IN_PROGRESS';
    } else if (error.message.includes('ocupado')) {
      message = 'El vehículo está ocupado o en mantenimiento';
      errorCode = 'VEHICLE_OCCUPIED';
    } else if (error.message.includes('conexión')) {
      message = 'Problemas de conexión. Reintentando...';
      errorCode = 'CONNECTION_ERROR';
    }

    return of({
      success: false,
      unlockRequestId: '',
      message,
      errorCode,
      estimatedRetryTime: error.message.includes('conexión') ?
        new Date(Date.now() + 30000) : undefined // 30 segundos para retry
    });
  }
}
