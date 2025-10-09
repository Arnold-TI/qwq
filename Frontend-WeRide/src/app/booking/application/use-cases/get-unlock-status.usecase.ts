import { Injectable } from '@angular/core';
import { Observable, of, interval } from 'rxjs';
import { map, switchMap, catchError, takeWhile, startWith } from 'rxjs/operators';
import { UnlockRequestRepository } from '../../domain/repositories/unlock-request.repository';
import { UnlockManagerService } from '../../domain/services/unlock-manager.service';

export interface UnlockStatusRequest {
  unlockRequestId?: string;
  bookingId?: string;
  userId: string;
}

export interface UnlockStatusResponse {
  unlockRequestId: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'expired';
  message: string;
  progress: number; // 0-100%
  estimatedTimeRemaining?: number; // segundos
  canRetry: boolean;
  retryCount: number;
  maxRetries: number;
  vehicleStatus?: {
    isLocked: boolean;
    batteryLevel: number;
    connectionStatus: string;
  };
  lastUpdated: Date;
}

@Injectable({
  providedIn: 'root'
})
export class GetUnlockStatusUseCase {
  constructor(
    private unlockRequestRepository: UnlockRequestRepository,
    private unlockManagerService: UnlockManagerService
  ) {}

  execute(request: UnlockStatusRequest): Observable<UnlockStatusResponse> {
    return this.getUnlockRequest(request).pipe(
      switchMap(unlockRequest => this.buildStatusResponse(unlockRequest)),
      catchError(error => this.handleStatusError(error))
    );
  }

  // Método para streaming en tiempo real
  executeRealTime(request: UnlockStatusRequest): Observable<UnlockStatusResponse> {
    return interval(2000).pipe( // Polling cada 2 segundos
      startWith(0),
      switchMap(() => this.execute(request)),
      takeWhile(response =>
          response.status === 'pending' || response.status === 'processing',
        true // Incluir el último valor cuando la condición se vuelve false
      )
    );
  }

  private getUnlockRequest(request: UnlockStatusRequest): Observable<any> {
    if (request.unlockRequestId) {
      return this.unlockRequestRepository.getUnlockRequestById(request.unlockRequestId);
    }

    if (request.bookingId) {
      return this.unlockRequestRepository.getUnlockRequestsByBookingId(request.bookingId).pipe(
        map(requests => {
          const latestRequest = requests
            .filter(req => req.userId === request.userId)
            .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())[0];

          if (!latestRequest) {
            throw new Error('No unlock request found for this booking');
          }

          return latestRequest;
        })
      );
    }

    throw new Error('Either unlockRequestId or bookingId must be provided');
  }

  private buildStatusResponse(unlockRequest: any): Observable<UnlockStatusResponse> {
    return this.unlockManagerService.getVehicleLockStatus(unlockRequest.vehicleId).pipe(
      map(vehicleStatus => {
        const progress = this.calculateProgress(unlockRequest);
        const estimatedTime = this.calculateEstimatedTime(unlockRequest);

        return {
          unlockRequestId: unlockRequest.id,
          status: unlockRequest.status,
          message: this.getStatusMessage(unlockRequest),
          progress,
          estimatedTimeRemaining: estimatedTime,
          canRetry: this.canRetry(unlockRequest),
          retryCount: unlockRequest.retryCount,
          maxRetries: unlockRequest.maxRetries,
          vehicleStatus: {
            isLocked: vehicleStatus.isLocked,
            batteryLevel: unlockRequest.vehicleBatteryLevel || 0,
            connectionStatus: unlockRequest.vehicleConnectionStatus
          },
          lastUpdated: new Date()
        };
      }),
      catchError(() =>
        // Si no se puede obtener el estado del vehículo, continuar sin esa info
        of({
          unlockRequestId: unlockRequest.id,
          status: unlockRequest.status,
          message: this.getStatusMessage(unlockRequest),
          progress: this.calculateProgress(unlockRequest),
          estimatedTimeRemaining: this.calculateEstimatedTime(unlockRequest),
          canRetry: this.canRetry(unlockRequest),
          retryCount: unlockRequest.retryCount,
          maxRetries: unlockRequest.maxRetries,
          lastUpdated: new Date()
        })
      )
    );
  }

  private calculateProgress(unlockRequest: any): number {
    switch (unlockRequest.status) {
      case 'pending':
        return 10;
      case 'processing':
        return 50;
      case 'success':
        return 100;
      case 'failed':
      case 'expired':
        return 100;
      default:
        return 0;
    }
  }

  private calculateEstimatedTime(unlockRequest: any): number | undefined {
    if (unlockRequest.status === 'processing') {
      // Estimar basado en intentos anteriores
      const avgResponseTime = unlockRequest.attemptLogs.length > 0
        ? unlockRequest.attemptLogs.reduce((sum: number, log: any) => sum + log.responseTime, 0) / unlockRequest.attemptLogs.length
        : 5000; // 5 segundos por defecto

      return Math.max(2, Math.ceil(avgResponseTime / 1000)); // Mínimo 2 segundos
    }

    return undefined;
  }

  private canRetry(unlockRequest: any): boolean {
    return unlockRequest.status === 'failed' &&
      unlockRequest.retryCount < unlockRequest.maxRetries &&
      (!unlockRequest.nextRetryAt || new Date() >= new Date(unlockRequest.nextRetryAt));
  }

  private getStatusMessage(unlockRequest: any): string {
    switch (unlockRequest.status) {
      case 'pending':
        return 'Solicitud de desbloqueo en cola...';
      case 'processing':
        return `Desbloqueando vehículo... (Intento ${unlockRequest.retryCount + 1})`;
      case 'success':
        return '¡Vehículo desbloqueado exitosamente!';
      case 'failed':
        const reason = unlockRequest.failureReason || 'Error desconocido';
        const canRetry = this.canRetry(unlockRequest);
        return canRetry
          ? `Error: ${reason}. Puedes reintentar.`
          : `Error: ${reason}. Contacta soporte si persiste.`;
      case 'expired':
        return 'La solicitud de desbloqueo ha expirado.';
      default:
        return 'Estado desconocido';
    }
  }

  private handleStatusError(error: any): Observable<UnlockStatusResponse> {
    return of({
      unlockRequestId: '',
      status: 'failed',
      message: 'Error al obtener el estado: ' + error.message,
      progress: 0,
      canRetry: false,
      retryCount: 0,
      maxRetries: 0,
      lastUpdated: new Date()
    });
  }
}
