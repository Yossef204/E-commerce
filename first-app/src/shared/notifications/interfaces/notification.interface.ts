export interface INotificationPayload {
  recipientId: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, any>;
}

export interface INotification {
  send(payload: INotificationPayload): Promise<void>;
  sendBatch(payloads: INotificationPayload[]): Promise<void>;
}
