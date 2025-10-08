export class Notification {
  constructor(
    public id: string,
    public userId: string,
    public type: 'sms' | 'email' | 'push',
    public message: string,
    public sentAt: Date,
    public status: 'sent' | 'pending' | 'failed'
  ) {}
}

