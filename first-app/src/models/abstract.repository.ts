import {
  Model,
  QueryFilter,
  ProjectionType,
  QueryOptions,
  UpdateQuery,
} from 'mongoose';

export abstract class AbstractRepo<T> {
  // تعريف المتغير كـ protected ليكون مرئياً في الكلاسات الفرعية
  protected readonly _model: Model<T>;

  constructor(model: Model<T>) {
    this._model = model;
  }

  public async create(data: Partial<T>): Promise<T> {
    const doc = new this._model(data);
    return (await doc.save()) as unknown as T;
  }

  public async getOne(
    filter: QueryFilter<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions,
  ): Promise<T | null> {
    return this._model.findOne(filter, projection, options).exec();
    return this._model
      .findOne(filter, projection, { lean: true, ...options })
      .exec() as Promise<T | null>;
  }

  public async getAll(
    filter: QueryFilter<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions,
  ): Promise<T[]> {
    return this._model.find(filter, projection, options).exec();
    return this._model
      .find(filter, projection, { lean: true, ...options })
      .exec() as Promise<T[]>;
  }

  public async updateOne(
    filter: QueryFilter<T>,
    data: UpdateQuery<T>,
    options: QueryOptions = {},
  ): Promise<T | null> {
    options.returnDocument = 'after';
    return this._model.findOneAndUpdate(filter, data, options).exec();
  }

  public async updateMany(
    filter: QueryFilter<T>,
    data: UpdateQuery<T>,
    options?: any,
  ) {
    return this._model.updateMany(filter, data, options).exec();
  }

  public async deleteOne(filter: QueryFilter<T>): Promise<T | null> {
    return this._model.findOneAndDelete(filter).exec();
  }
}
