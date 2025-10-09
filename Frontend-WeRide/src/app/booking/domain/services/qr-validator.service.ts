import { Observable } from 'rxjs';

export interface QRValidationResult {
  isValid: boolean;
  vehicleId?: string;
  bookingId?: string;
  expiresAt?: Date;
  errorMessage?: string;
  validationDetails: {
    formatValid: boolean;
    signatureValid: boolean;
    notExpired: boolean;
    vehicleExists: boolean;
    userAuthorized: boolean;
  };
}

export abstract class QRValidatorService {
  // Validación de códigos QR
  abstract validateQRCode(qrData: string, userId: string): Observable<QRValidationResult>;
  abstract generateQRCodeForVehicle(vehicleId: string, bookingId: string): Observable<string>;
  abstract parseQRData(qrData: string): Observable<any>;

  // Validaciones específicas
  abstract validateQRFormat(qrData: string): boolean;
  abstract validateQRSignature(qrData: string): boolean;
  abstract validateQRExpiration(qrData: string): boolean;
  abstract validateUserAuthorization(qrData: string, userId: string): Observable<boolean>;

  // Utilidades
  abstract extractVehicleIdFromQR(qrData: string): string | null;
  abstract extractBookingIdFromQR(qrData: string): string | null;
  abstract isQRExpired(qrData: string): boolean;
  abstract getQRExpirationTime(qrData: string): Date | null;
}
