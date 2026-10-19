export enum PaymentMethod {
  CARD = 'CARD',
  WALLET = 'WALLET',
  INSTAPAY = 'INSTAPAY',
  COD = 'COD',
  // Gateway & Backward Compatibility Aliases
  STRIPE = 'CARD',
  PAYMOB = 'CARD',
  VODAFONE_CASH = 'WALLET',
  CASH_ON_DELIVERY = 'COD',
  MOCK = 'MOCK',
}

