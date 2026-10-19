import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { Review, TReview } from './review.schema';

@Injectable()
export class ReviewRepo extends AbstractRepo<TReview> {
  constructor(
    @InjectModel(Review.name) reviewModel: Model<TReview>,
  ) {
    super(reviewModel);
  }

  public get model(): Model<TReview> {
    return this._model;
  }
}

