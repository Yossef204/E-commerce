export class PaymentReceivedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly mainOrderId: string,
    public readonly customerId: string,
    public readonly amount: number,
  ) {}
}
