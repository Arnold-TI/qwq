import { Injectable } from '@angular/core';
import { Observable, of, throwError, timer } from 'rxjs';
import { map, switchMap, catchError, retryWhen, delayWhen } from 'rxjs/operators';
import { UnlockManagerService, UnlockResult } from '../../domain/services/unlock-manager.service';
import { UnlockRequest } from '../../domain/model/unlockRequest.entity';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class VehicleUnlockServiceImpl extends UnlockManagerService {
  private readonly API_URL = 'http://localhost:3000/api';
  private readonly VEHICLE_API_URL = 'http://localhost:3001/vehicle-api'; // API simulada de vehículos

  constructor(private http: HttpClient) {
    super();
  }

  unlockWithQR(qrData: string, userId: string, location: any): Observable<UnlockResult> {
    return this.validateQRUnlockConditions(qrData, userId, location).pipe(
      switchMap(validation => {
        if (!validation.isValid) {
          return of({
            success: false,
            unlockRequestId: '',
            message: validation.errorMessage || 'QR inválido',
            errorCode: 'QR_VALIDATION_FAILED'
          });
        }

        return this.performVehicleUnlock(validation.vehicleId, 'qr_code', {
          qrData,
          userLocation: location
        });
      })
    );
  }

  unlockFromApp(bookingId: string, userId: string): Observable<UnlockResult> {
    return this.validateAppUnlockConditions(bookingId, userId).pipe(
      switchMap(validation => {
        if (!validation.isValid) {
          return of({
            success: false,
            unlockRequestId: '',
            message: validation.errorMessage || 'Condiciones no válidas',
            errorCode: 'APP_VALIDATION_FAILED'
          });
        }

        return this.performVehicleUnlock(validation.vehicleId, 'app_button', {
          bookingId,
          userId
        });
      })
    );
  }

  scheduleUnlock(bookingId: string, scheduledTime: Date): Observable<UnlockResult> {
    return this.http.get<any>(`${this.API_URL}/bookings/${bookingId}`).pipe(
      switchMap(booking => {
        const unlockRequest: UnlockRequest = {
          id: this.generateUnlockRequestId(),
          bookingId,
          vehicleId: booking.vehicleId,
          userId: booking.userId,
          method: 'scheduled',
          status: 'pending',
          requestedAt: new Date(),
          scheduledFor: scheduledTime,
          requestLocation: { lat: 0, lng: 0 },
          vehicleLocation: { lat: 0, lng: 0 },
          distanceValidation: false,
          maxDistanceMeters: 100,
          retryCount: 0,
          maxRetries: 3,
          vehicleConnectionStatus: 'online',
          attemptLogs: []
        };

        return this.http.post<UnlockRequest>(`${this.API_URL}/unlock-requests`, unlockRequest).pipe(
          map(savedRequest => ({
            success: true,
            unlockRequestId: savedRequest.id,
            message: `Desbloqueo programado para ${scheduledTime.toLocaleString('es-PE')}`,
            estimatedRetryTime: scheduledTime
          }))
        );
      }),
      catchError(error => of({
        success: false,
        unlockRequestId: '',
        message: 'Error al programar desbloqueo: ' + error.message,
        errorCode: 'SCHEDULE_FAILED'
      }))
    );
  }

  getUnlockStatus(unlockRequestId: string): Observable<UnlockRequest> {
    return this.http.get<UnlockRequest>(`${this.API_URL}/unlock-requests/${unlockRequestId}`).pipe(
      catchError(error => {
        console.error('Error getting unlock status:', error);
        throw error;
      })
    );
  }

  isVehicleUnlocked(vehicleId: string): Observable<boolean> {
    return this.http.get<any>(`${this.VEHICLE_API_URL}/vehicles/${vehicleId}/status`).pipe(
      map(status => !status.isLocked),
      catchError(() => of(false)) // Asumir bloqueado si no se puede verificar
    );
  }

  getVehicleLockStatus(vehicleId: string): Observable<any> {
    return this.http.get<any>(`${this.VEHICLE_API_URL}/vehicles/${vehicleId}/lock-status`).pipe(
      catchError(() => of({
        isLocked: true,
        batteryLevel: 0,
        connectionStatus: 'offline',
        canUnlock: false
      }))
    );
  }

  validateUnlockConditions(bookingId: string, method: string): Observable<boolean> {
    return this.http.get<any>(`${this.API_URL}/bookings/${bookingId}`).pipe(
      switchMap(booking => {
        // Validaciones básicas
        if (!booking || booking.status !== 'active') {
          return of(false);
        }

        // Validaciones específicas por método
        switch (method) {
          case 'qr_code':
            return this.validateQRMethodConditions(booking);
          case 'app_button':
            return this.validateAppMethodConditions(booking);
          case 'scheduled':
            return this.validateScheduledMethodConditions(booking);
          default:
            return of(false);
        }
      }),
      catchError(() => of(false))
    );
  }

  checkVehicleAvailability(vehicleId: string): Observable<boolean> {
    return this.http.get<any>(`${this.API_URL}/vehicles/${vehicleId}`).pipe(
      switchMap(vehicle => {
        if (!vehicle || vehicle.status !== 'available') {
          return of(false);
        }

        return this.getVehicleLockStatus(vehicleId).pipe(
          map(lockStatus => lockStatus.connectionStatus === 'online' && lockStatus.canUnlock)
        );
      }),
      catchError(() => of(false))
    );
  }

  validateUserDistance(userId: string, vehicleId: string): Observable<boolean> {
    // En una implementación real, obtendríamos la ubicación actual del usuario
    // Por ahora simulamos la validación
    return of(true);
  }

  retryUnlockRequest(unlockRequestId: string): Observable<UnlockResult> {
    return this.getUnlockStatus(unlockRequestId).pipe(
      switchMap(request => {
        if (request.retryCount >= request.maxRetries) {
          return of({
            success: false,
            unlockRequestId,
            message: 'Máximo número de reintentos alcanzado',
            errorCode: 'MAX_RETRIES_EXCEEDED'
          });
        }

        // Incrementar contador de reintentos
        const updatedRequest = {
          ...request,
          retryCount: request.retryCount + 1,
          status: 'pending' as const
        };

        return this.http.put(`${this.API_URL}/unlock-requests/${unlockRequestId}`, updatedRequest).pipe(
          switchMap(() => {
            switch (request.method) {
              case 'qr_code':
                return this.unlockWithQR(request.qrCode!, request.userId, request.requestLocation);
              case 'app_button':
                return this.unlockFromApp(request.bookingId, request.userId);
              default:
                return of({
                  success: false,
                  unlockRequestId,
                  message: 'Método de desbloqueo no soportado para reintento',
                  errorCode: 'UNSUPPORTED_RETRY_METHOD'
                });
            }
          })
        );
      })
    );
  }

  cancelUnlockRequest(unlockRequestId: string): Observable<boolean> {
    return this.http.patch(`${this.API_URL}/unlock-requests/${unlockRequestId}`, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  getFailedUnlockRequests(userId: string): Observable<UnlockRequest[]> {
    return this.http.get<UnlockRequest[]>(`${this.API_URL}/unlock-requests?userId=${userId}&status=failed`).pipe(
      catchError(() => of([]))
    );
  }

  // Métodos privados auxiliares
  private performVehicleUnlock(vehicleId: string, method: string, data: any): Observable<UnlockResult> {
    const unlockRequestId = this.generateUnlockRequestId();

    return this.sendUnlockCommand(vehicleId, method, data).pipe(
      retryWhen(errors =>
        errors.pipe(
          delayWhen(() => timer(2000)), // Esperar 2 segundos entre reintentos
          map((error, index) => {
            if (index >= 2) { // Máximo 3 intentos
              throw error;
            }
            return error;
          })
        )
      ),
      map(response => ({
        success: true,
        unlockRequestId,
        message: 'Vehículo desbloqueado exitosamente'
      })),
      catchError(error => of({
        success: false,
        unlockRequestId,
        message: this.getUnlockErrorMessage(error),
        errorCode: this.getUnlockErrorCode(error),
        estimatedRetryTime: new Date(Date.now() + 30000) // 30 segundos
      }))
    );
  }

  private sendUnlockCommand(vehicleId: string, method: string, data: any): Observable<any> {
    // Simular llamada a la API del vehículo
    return this.http.post(`${this.VEHICLE_API_URL}/vehicles/${vehicleId}/unlock`, {
      method,
      timestamp: Date.now(),
      ...data
    }).pipe(
      // Simular posibles fallos de conexión
      switchMap(response => {
        if (Math.random() < 0.1) { // 10% de probabilidad de fallo
          return throwError(() => new Error('Connection timeout'));
        }
        return of(response);
      })
    );
  }

  private validateQRUnlockConditions(qrData: string, userId: string, location: any): Observable<any> {
    // Implementación simplificada - en producción sería más robusta
    return of({
      isValid: qrData.startsWith('weride://'),
      vehicleId: this.extractVehicleIdFromQR(qrData),
      errorMessage: qrData.startsWith('weride://') ? null : 'QR inválido'
    });
  }

  private validateAppUnlockConditions(bookingId: string, userId: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/bookings/${bookingId}`).pipe(
      map(booking => ({
        isValid: booking && booking.userId === userId && booking.status === 'active',
        vehicleId: booking?.vehicleId,
        errorMessage: !booking ? 'Reserva no encontrada' :
          booking.userId !== userId ? 'No autorizado' :
            booking.status !== 'active' ? 'Reserva no activa' : null
      })),
      catchError(() => of({
        isValid: false,
        errorMessage: 'Error al validar condiciones'
      }))
    );
  }

  private validateQRMethodConditions(booking: any): Observable<boolean> {
    // Validar que el QR esté habilitado y el vehículo esté cerca
    return of(true); // Simplificado
  }

  private validateAppMethodConditions(booking: any): Observable<boolean> {
    // Validar conectividad y proximidad
    return of(true); // Simplificado
  }

  private validateScheduledMethodConditions(booking: any): Observable<boolean> {
    // Validar que se pueda programar desbloqueo
    return of(true); // Simplificado
  }

  private extractVehicleIdFromQR(qrData: string): string {
    // Extraer ID del vehículo del QR
    try {
      const parts = qrData.split('/');
      return parts[parts.length - 1] || '';
    } catch {
      return '';
    }
  }

  private getUnlockErrorMessage(error: any): string {
    if (error.message.includes('timeout')) {
      return 'Error de conexión con el vehículo. Reintentando...';
    }
    if (error.message.includes('battery')) {
      return 'Batería del vehículo muy baja para desbloquear';
    }
    if (error.message.includes('occupied')) {
      return 'El vehículo está siendo usado por otro usuario';
    }
    return 'Error desconocido al desbloquear';
  }

  private getUnlockErrorCode(error: any): string {
    if (error.message.includes('timeout')) return 'CONNECTION_TIMEOUT';
    if (error.message.includes('battery')) return 'LOW_BATTERY';
    if (error.message.includes('occupied')) return 'VEHICLE_OCCUPIED';
    return 'UNKNOWN_ERROR';
  }

  private generateUnlockRequestId(): string {
    return 'unlock-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
  }
}
