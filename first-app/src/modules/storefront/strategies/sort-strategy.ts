export interface ISortStrategy {
  applySort(): Record<string, 1 | -1>;
}

export class NewestSortStrategy implements ISortStrategy {
  applySort(): Record<string, 1 | -1> {
    return { createdAt: -1 };
  }
}

export class PriceAscSortStrategy implements ISortStrategy {
  applySort(): Record<string, 1 | -1> {
    return { 'variants.price': 1 };
  }
}

export class PriceDescSortStrategy implements ISortStrategy {
  applySort(): Record<string, 1 | -1> {
    return { 'variants.price': -1 };
  }
}

export class TitleSortStrategy implements ISortStrategy {
  constructor(private readonly order: 1 | -1 = 1) {}
  applySort(): Record<string, 1 | -1> {
    return { title: this.order };
  }
}

export class SortStrategyFactory {
  static getStrategy(sortBy?: string, sortOrder?: string): ISortStrategy {
    const normalizedSortBy = (sortBy || '').toUpperCase();
    const normalizedOrder = (sortOrder || '').toUpperCase();

    if (normalizedSortBy === 'PRICE_ASC' || (normalizedSortBy === 'PRICE' && normalizedOrder === 'ASC')) {
      return new PriceAscSortStrategy();
    }

    if (normalizedSortBy === 'PRICE_DESC' || (normalizedSortBy === 'PRICE' && normalizedOrder === 'DESC')) {
      return new PriceDescSortStrategy();
    }

    if (normalizedSortBy === 'TITLE' || normalizedSortBy === 'NAME') {
      return new TitleSortStrategy(normalizedOrder === 'DESC' ? -1 : 1);
    }

    return new NewestSortStrategy();
  }
}
