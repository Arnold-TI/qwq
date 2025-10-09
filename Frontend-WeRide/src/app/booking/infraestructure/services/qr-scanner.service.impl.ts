import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { QRValidatorService, QRValidationResult } from '../../domain/services/qr-validator.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class QRScannerServiceImpl extends QRValidatorService {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {
    super();
  }

  validateQRCode(qrData: string, userId: string): Observable<QRValidationResult> {
    try {
      const parsedData = this.parseQRData(qrData);

      return this.performValidations(parsedData, userId).pipe(
        map(validations => ({
          isValid: Object.values(validations).every(v => v),
          vehicleId: parsedData.vehicleId,
          bookingId: parsedData.bookingId,
          expiresAt: parsedData.expiresAt ? new Date(parsedData.expiresAt) : undefined,
          errorMessage: this.getValidationErrorMessage(validations),
          validationDetails: validations
        })),
        catchError(error => of({
          isValid: false,
          errorMessage: error.message,
          validationDetails: {
            formatValid: false,
            signatureValid: false,
            notExpired: false,
            vehicleExists: false,
            userAuthorized: false
          }
        }))
      );
    } catch (error) {
      return of({
        isValid: false,
        errorMessage: 'Formato de QR inválido',
        validationDetails: {
          formatValid: false,
          signatureValid: false,
          notExpired: false,
          vehicleExists: false,
          userAuthorized: false
        }
      });
    }
  }

  generateQRCodeForVehicle(vehicleId: string, bookingId: string): Observable<string> {
    const expirationTime = new Date(Date.now() + (5 * 60 * 1000)); // 5 minutos
    const qrData = {
      vehicleId,
      bookingId,
      timestamp: Date.now(),
      expiresAt: expirationTime.toISOString(),
      signature: this.generateSignature(vehicleId, bookingId, expirationTime)
    };

    const encodedData = btoa(JSON.stringify(qrData));
    return of(`weride://unlock/${encodedData}`);
  }

  parseQRData(qrData: string): Observable<any> {
    return new Observable(observer => {
      try {
        const parsed = this.parseQRDataSync(qrData);
        observer.next(parsed);
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  validateQRFormat(qrData: string): boolean {
    return qrData.startsWith('weride://unlock/') && qrData.length > 20;
  }

  validateQRSignature(qrData: string): boolean {
    try {
      const parsed = this.parseQRDataSync(qrData);
      const expectedSignature = this.generateSignature(
        parsed.vehicleId,
        parsed.bookingId,
        new Date(parsed.expiresAt)
      );
      return parsed.signature === expectedSignature;
    } catch {
      return false;
    }
  }

  validateQRExpiration(qrData: string): boolean {
    try {
      const parsed = this.parseQRDataSync(qrData);
      const expirationTime = new Date(parsed.expiresAt);
      return expirationTime > new Date();
    } catch {
      return false;
    }
  }

  validateUserAuthorization(qrData: string, userId: string): Observable<boolean> {
    try {
      const parsed = this.parseQRDataSync(qrData);

      // Verificar que el usuario tenga una reserva activa para este vehículo
      return this.http.get<any[]>(`${this.API_URL}/bookings?userId=${userId}&vehicleId=${parsed.vehicleId}&status=active`).pipe(
        map(bookings => bookings.length > 0),
        catchError(() => of(false))
      );
    } catch {
      return of(false);
    }
  }

  extractVehicleIdFromQR(qrData: string): string | null {
    try {
      const parsed = this.parseQRDataSync(qrData);
      return parsed.vehicleId || null;
    } catch {
      return null;
    }
  }

  extractBookingIdFromQR(qrData: string): string | null {
    try {
      const parsed = this.parseQRDataSync(qrData);
      return parsed.bookingId || null;
    } catch {
      return null;
    }
  }

  isQRExpired(qrData: string): boolean {
    return !this.validateQRExpiration(qrData);
  }

  getQRExpirationTime(qrData: string): Date | null {
    try {
      const parsed = this.parseQRDataSync(qrData);
      return parsed.expiresAt ? new Date(parsed.expiresAt) : null;
    } catch {
      return null;
    }
  }

  // Métodos privados auxiliares
  private parseQRDataSync(qrData: string): any {
    if (!this.validateQRFormat(qrData)) {
      throw new Error('Invalid QR format');
    }

    const encodedData = qrData.replace('weride://unlock/', '');
    const decodedData = atob(encodedData);
    return JSON.parse(decodedData);
  }

  private performValidations(parsedData: any, userId: string): Observable<any> {
    return this.validateUserAuthorization(parsedData, userId).pipe(
      switchMap(userAuthorized =>
        this.checkVehicleExists(parsedData.vehicleId).pipe(
          map(vehicleExists => ({
            formatValid: true,
            signatureValid: this.validateQRSignature(`weride://unlock/${btoa(JSON.stringify(parsedData))}`),
            notExpired: this.validateQRExpiration(`weride://unlock/${btoa(JSON.stringify(parsedData))}`),
            vehicleExists,
            userAuthorized
          }))
        )
      )
    );
  }

  private checkVehicleExists(vehicleId: string): Observable<boolean> {
    return this.http.get(`${this.API_URL}/vehicles/${vehicleId}`).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  private validateUserAuthorization(parsedData: any, userId: string): Observable<boolean> {
    // Verificar que el usuario tenga una reserva activa para este vehículo
    return this.http.get<any[]>(`${this.API_URL}/bookings?userId=${userId}&vehicleId=${parsedData.vehicleId}&status=active`).pipe(
      map(bookings => bookings.some(booking => booking.id === parsedData.bookingId)),
      catchError(() => of(false))
    );
  }

  private generateSignature(vehicleId: string, bookingId: string, expirationTime: Date): string {
    // Simulación de firma (en producción usaría HMAC o similar)
    const data = `${vehicleId}-${bookingId}-${expirationTime.getTime()}`;
    return btoa(data).substring(0, 16); // Simplified signature
  }

  private getValidationErrorMessage(validations: any): string | undefined {
    if (!validations.formatValid) return 'Formato de QR inválido';
    if (!validations.signatureValid) return 'QR no auténtico';
    if (!validations.notExpired) return 'QR expirado';
    if (!validations.vehicleExists) return 'Vehículo no encontrado';
    if (!validations.userAuthorized) return 'No autorizado para este vehículo';
    return undefined;
  }
}
