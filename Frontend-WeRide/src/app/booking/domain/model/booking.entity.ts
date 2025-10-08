export class Booking {
  constructor(
    public id: string,
    public userId: string,
    public vehicleId: string,
    public startDate: Date,
    public endDate: Date,
    public status: 'pending' | 'confirmed' | 'cancelled'
  ) {}
}

