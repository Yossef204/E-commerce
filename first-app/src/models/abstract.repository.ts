import {
  Model,
  QueryFilter,
  ProjectionType,
  QueryOptions,
  UpdateQuery,
  Types,
} from 'mongoose';

export abstract class AbstractRepo<T> {
  // تعريف المتغير كـ protected ليكون مرئياً في الكلاسات الفرعية
  protected readonly _model: Model<T>;

  constructor(model: Model<T>) {
    this._model = model;
  }

  public get model(): Model<T> {
    return this._model;
  }

  public async create(data: Partial<T>, options?: any): Promise<T> {
    const doc = new this._model(data);
    return (await doc.save(options)) as unknown as T;
  }

  public async getOne(
    filter: QueryFilter<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions,
  ): Promise<T | null> {
    return this._model.findOne(filter, projection, options).exec();
  }

  public async getAll(
    filter: QueryFilter<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions,
  ): Promise<T[]> {
    return this._model.find(filter, projection, options).exec();
  }

  public async findManyByIds(ids: (string | Types.ObjectId)[]): Promise<T[]> {
    const validIds = ids
      .filter((id) => Boolean(id) && Types.ObjectId.isValid(id.toString()))
      .map((id) => new Types.ObjectId(id.toString()));
    if (validIds.length === 0) return [];
    return this._model.find({ _id: { $in: validIds } } as any).exec();
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
