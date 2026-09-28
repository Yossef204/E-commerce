export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly orderNumber: string,
    public readonly totalAmount: number,
    public readonly sellerEntityIds: string[],
  ) {}
}

export class OrderStatusUpdatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly recipientId: string,
    public readonly status: string,
    public readonly note?: string,
  ) {}
}

export class EscrowReleasedEvent {
  constructor(
    public readonly entityOrderId: string,
    public readonly sellingEntityId: string,
    public readonly vendorOwnerId: string,
    public readonly amount: number,
  ) {}
}
