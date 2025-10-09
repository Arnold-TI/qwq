import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ScheduleUnlockUseCase } from '../../../application/use-cases/schedule-unlock.usecase';
import { BookingRepository } from '../../../domain/repositories/booking.repository';

interface TimeSlot {
  time: string;
  label: string;
  available: boolean;
  recommended?: boolean;
}

@Component({
  selector: 'app-schedule-unlock',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './schedule-unlock.html',
  styleUrls: ['./schedule-unlock.css']
})
export class ScheduleUnlockComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  scheduleForm: FormGroup;
  bookingInfo: any = null;
  vehicleInfo: any = null;

  // Configuración de horarios
  availableTimeSlots: TimeSlot[] = [];
  selectedTimeSlot: TimeSlot | null = null;

  // Estados del componente
  isLoading = false;
  isSubmitting = false;
  showConfirmation = false;

  // Resultado de programación
  scheduledUnlock: any = null;

  // Configuración
  notificationMinutesBefore = [5, 10, 15, 30];
  maxAdvanceHours = 24;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private scheduleUnlockUseCase: ScheduleUnlockUseCase,
    private bookingRepository: BookingRepository
  ) {
    this.scheduleForm = this.initializeForm();
  }

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): FormGroup {
    const now = new Date();
    const defaultTime = new Date(now.getTime() + (30 * 60 * 1000)); // 30 minutos desde ahora

    return this.fb.group({
      bookingId: ['', Validators.required],
      scheduledDate: [this.formatDateForInput(defaultTime), Validators.required],
      scheduledTime: [this.formatTimeForInput(defaultTime), Validators.required],
      notifyMinutesBefore: [10, [Validators.min(1), Validators.max(60)]],
      autoUnlock: [true],
      confirmSchedule: [false, Validators.requiredTrue]
    });
  }

  private initializeComponent(): void {
    // Obtener bookingId de los parámetros de consulta
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      const bookingId = params['bookingId'];

      if (bookingId) {
        this.scheduleForm.patchValue({ bookingId });
        this.loadBookingInfo(bookingId);
      } else {
        this.findActiveBooking();
      }
    });

    this.setupFormSubscriptions();
    this.generateTimeSlots();
  }

  private setupFormSubscriptions(): void {
    // Actualizar slots disponibles cuando cambie la fecha
    this.scheduleForm.get('scheduledDate')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.generateTimeSlots();
      this.validateSelectedTime();
    });

    // Actualizar cuando cambie la hora
    this.scheduleForm.get('scheduledTime')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.validateSelectedTime();
    });
  }

  private loadBookingInfo(bookingId: string): void {
    this.isLoading = true;

    this.bookingRepository.getBookingById(bookingId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (booking) => {
        if (booking) {
          this.bookingInfo = booking;
          this.loadVehicleInfo(booking.vehicleId);
        } else {
          this.handleError('Reserva no encontrada');
        }
      },
      error: (error) => {
        this.handleError('Error al cargar información de la reserva');
      }
    });
  }

  private findActiveBooking(): void {
    const userId = this.getCurrentUserId();

    this.bookingRepository.getActiveBookingByUserId(userId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (booking) => {
        if (booking) {
          this.bookingInfo = booking;
          this.scheduleForm.patchValue({ bookingId: booking.id });
          this.loadVehicleInfo(booking.vehicleId);
        } else {
          this.handleError('No tienes reservas activas');
        }
      },
      error: (error) => {
        this.handleError('Error al buscar reserva activa');
      }
    });
  }

  private loadVehicleInfo(vehicleId: string): void {
    // Simular carga de información del vehículo
    this.vehicleInfo = {
      id: vehicleId,
      brand: 'Xiaomi',
      model: 'M365',
      battery: 85,
      location: 'Plaza San Martín',
      image: '/assets/vehicles/xiaomi-m365.jpg'
    };

    this.isLoading = false;
  }

  // Generar slots de tiempo disponibles
  private generateTimeSlots(): void {
    const selectedDate = this.scheduleForm.get('scheduledDate')?.value;
    if (!selectedDate) return;

    const date = new Date(selectedDate);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    this.availableTimeSlots = [];

    // Generar slots cada 15 minutos
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const slotTime = new Date(date);
        slotTime.setHours(hour, minute, 0, 0);

        // Solo mostrar slots futuros para hoy
        if (isToday && slotTime <= now) {
          continue;
        }

        // Solo dentro de las próximas 24 horas
        const hoursFromNow = (slotTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursFromNow > this.maxAdvanceHours) {
          continue;
        }

        const timeString = this.formatTimeForInput(slotTime);
        const isRecommended = hoursFromNow >= 0.5 && hoursFromNow <= 2; // Entre 30 min y 2 horas

        this.availableTimeSlots.push({
          time: timeString,
          label: this.formatTimeDisplay(slotTime),
          available: true,
          recommended: isRecommended
        });
      }
    }
  }

  private validateSelectedTime(): void {
    const selectedDate = this.scheduleForm.get('scheduledDate')?.value;
    const selectedTime = this.scheduleForm.get('scheduledTime')?.value;

    if (!selectedDate || !selectedTime) return;

    const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}`);
    const now = new Date();

    // Validar que sea en el futuro
    if (scheduledDateTime <= now) {
      this.scheduleForm.get('scheduledTime')?.setErrors({
        'pastTime': 'La hora debe ser futura'
      });
      return;
    }

    // Validar que esté dentro de las próximas 24 horas
    const hoursFromNow = (scheduledDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursFromNow > this.maxAdvanceHours) {
      this.scheduleForm.get('scheduledTime')?.setErrors({
        'tooAdvance': `Máximo ${this.maxAdvanceHours} horas de anticipación`
      });
      return;
    }

    // Validar que esté dentro del período de la reserva (si existe)
    if (this.bookingInfo) {
      const bookingStart = new Date(this.bookingInfo.scheduledStartTime);
      const bookingEnd = new Date(this.bookingInfo.scheduledEndTime);

      if (scheduledDateTime < bookingStart || scheduledDateTime > bookingEnd) {
        this.scheduleForm.get('scheduledTime')?.setErrors({
          'outOfRange': 'Debe estar dentro del período de la reserva'
        });
        return;
      }
    }

    // Limpiar errores si todo está bien
    this.scheduleForm.get('scheduledTime')?.setErrors(null);
  }

  // US-22: Programar desbloqueo
  onSubmit(): void {
    if (this.scheduleForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    const formValue = this.scheduleForm.value;

    const scheduledTime = new Date(`${formValue.scheduledDate}T${formValue.scheduledTime}`);

    const request = {
      bookingId: formValue.bookingId,
      userId: this.getCurrentUserId(),
      scheduledTime,
      notifyMinutesBefore: formValue.notifyMinutesBefore,
      autoUnlock: formValue.autoUnlock
    };

    this.scheduleUnlockUseCase.execute(request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        this.isSubmitting = false;

        if (result.success) {
          this.scheduledUnlock = {
            ...result,
            scheduledTime: scheduledTime
          };
          this.showConfirmation = true;

          // Redirigir después de mostrar confirmación
          setTimeout(() => {
            this.router.navigate(['/booking/unlock-status'], {
              queryParams: { unlockRequestId: result.unlockRequestId }
            });
          }, 3000);
        } else {
          this.handleError(result.message);
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        this.handleError('Error al programar desbloqueo: ' + error.message);
      }
    });
  }

  // Seleccionar slot de tiempo
  selectTimeSlot(slot: TimeSlot): void {
    if (!slot.available) return;

    this.selectedTimeSlot = slot;
    this.scheduleForm.patchValue({
      scheduledTime: slot.time
    });
  }

  // Manejar errores
  private handleError(message: string): void {
    // Implementar manejo de errores (toast, modal, etc.)
    console.error('Schedule unlock error:', message);
    alert('Error: ' + message);
  }

  // Navegar atrás
  goBack(): void {
    this.router.navigate(['/booking/unlock-vehicle']);
  }

  // Obtener usuario actual
  private getCurrentUserId(): string {
    return localStorage.getItem('currentUserId') || '1';
  }

  // Métodos de utilidad para formateo
  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatTimeForInput(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  private formatTimeDisplay(date: Date): string {
    return date.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Validaciones del formulario
  isFieldInvalid(fieldName: string): boolean {
    const field = this.scheduleForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.scheduleForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['pastTime']) return field.errors['pastTime'];
      if (field.errors['tooAdvance']) return field.errors['tooAdvance'];
      if (field.errors['outOfRange']) return field.errors['outOfRange'];
      if (field.errors['min']) return `Valor mínimo: ${field.errors['min'].min}`;
      if (field.errors['max']) return `Valor máximo: ${field.errors['max'].max}`;
    }
    return '';
  }

  // Obtener información del slot seleccionado
  getSelectedSlotInfo(): string {
    if (!this.selectedTimeSlot) return '';

    const date = this.scheduleForm.get('scheduledDate')?.value;
    if (!date) return '';

    const scheduledTime = new Date(`${date}T${this.selectedTimeSlot.time}`);
    return this.formatDateTime(scheduledTime);
  }
}
