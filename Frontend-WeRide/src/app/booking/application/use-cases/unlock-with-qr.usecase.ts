import { Injectable } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { UnlockRequestRepository } from '../../domain/repositories/unlock-request.repository';
import { QRValidatorService } from '../../domain/services/qr-validator.service';
import { UnlockManagerService, UnlockResult } from '../../domain/services/unlock-manager.service';
import { UnlockRequest, LocationCoordinates } from '../../domain/model/unlockRequest.entity';

export interface UnlockWithQRRequest {
  qrData: string;
  userId: string;
  userLocation: LocationCoordinates;
}

@Injectable({
  providedIn: 'root'
})
export class UnlockWithQRUseCase {
  constructor(
    private unlockRequestRepository: UnlockRequestRepository,
    private qrValidatorService: QRValidatorService,
    private unlockManagerService: UnlockManagerService
  ) {}

  execute(request: UnlockWithQRRequest): Observable<UnlockResult> {
    return this.validateQRCode(request).pipe(
      switchMap(validationResult => {
        if (!validationResult.isValid) {
          return throwError(() => new Error(`QR inválido: ${validationResult.errorMessage}`));
        }
        return this.createUnlockRequest(request, validationResult);
      }),
      switchMap(unlockRequest => this.processUnlock(unlockRequest)),
      catchError(error => this.handleUnlockError(error))
    );
  }

  private validateQRCode(request: UnlockWithQRRequest): Observable<any> {
    return this.qrValidatorService.validateQRCode(request.qrData, request.userId).pipe(
      map(validationResult => {
        // Validaciones específicas US-19
        if (!validationResult.isValid) {
          throw new Error(validationResult.errorMessage || 'QR code is invalid');
        }

        if (!validationResult.validationDetails.formatValid) {
          throw new Error('Formato de QR inválido');
        }

        if (!validationResult.validationDetails.notExpired) {
          throw new Error('El código QR ha expirado');
        }

        if (!validationResult.validationDetails.userAuthorized) {
          throw new Error('No tienes autorización para usar este vehículo');
        }

        if (!validationResult.validationDetails.vehicleExists) {
          throw new Error('El vehículo no existe o no está disponible');
        }

        return validationResult;
      })
    );
  }

  private createUnlockRequest(request: UnlockWithQRRequest, validationResult: any): Observable<UnlockRequest> {
    const unlockRequest: UnlockRequest = {
      id: this.generateUnlockRequestId(),
      bookingId: validationResult.bookingId,
      vehicleId: validationResult.vehicleId,
      userId: request.userId,
      method: 'qr_code',
      status: 'pending',
      requestedAt: new Date(),
      qrCode: request.qrData,
      qrScannedAt: new Date(),
      requestLocation: request.userLocation,
      vehicleLocation: { lat: 0, lng: 0 },
      distanceValidation: false,
      maxDistanceMeters: 50,
      retryCount: 0,
      maxRetries: 3,
      vehicleConnectionStatus: 'online',
      attemptLogs: []
    };

    return this.unlockRequestRepository.createUnlockRequest(unlockRequest);
  }

  private processUnlock(unlockRequest: UnlockRequest): Observable<UnlockResult> {
    return this.unlockManagerService.unlockWithQR(
      unlockRequest.qrCode!,
      unlockRequest.userId,
      unlockRequest.requestLocation
    ).pipe(
      switchMap(result => {
        const updatedRequest: UnlockRequest = {
          ...unlockRequest,
          status: result.success ? ('success' as const) : ('failed' as const),
          completedAt: result.success ? new Date() : undefined,
          failureReason: result.success ? undefined : result.message
        };

        return this.unlockRequestRepository.updateUnlockRequest(updatedRequest).pipe(
          map(() => result)
        );
      })
    );
  }

  private generateUnlockRequestId(): string {
    return 'unlock-qr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  private handleUnlockError(error: any): Observable<UnlockResult> {
    let message = 'Error al desbloquear con QR';
    let errorCode = 'QR_UNLOCK_ERROR';

    if (error.message.includes('inválido')) {
      message = 'El código QR no es válido';
      errorCode = 'INVALID_QR';
    } else if (error.message.includes('expirado')) {
      message = 'El código QR ha expirado';
      errorCode = 'QR_EXPIRED';
    } else if (error.message.includes('autorización')) {
      message = 'No tienes autorización para este vehículo';
      errorCode = 'UNAUTHORIZED';
    } else if (error.message.includes('connection')) {
      message = 'Error de conexión. Intenta de nuevo';
      errorCode = 'CONNECTION_ERROR';
    }

    return of({
      success: false,
      unlockRequestId: '',
      message,
      errorCode
    });
  }
}
