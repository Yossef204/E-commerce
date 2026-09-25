export class OrderPlacedEvent {
  constructor(
    public readonly mainOrderId: string,
    public readonly orderNumber: string,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly sellerEntityIds: string[],
  ) {}
}

