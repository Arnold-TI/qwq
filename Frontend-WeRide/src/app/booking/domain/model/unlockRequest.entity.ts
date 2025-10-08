export class UnlockRequest {
  constructor(
    public id: string,
    public userId: string,
    public vehicleId: string,
    public requestedAt: Date,
    public unlockTime: Date,
    public status: 'pending' | 'unlocked' | 'failed'
  ) {}
}

