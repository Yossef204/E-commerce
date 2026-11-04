import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { MailModule } from '../../shared/mailer/mail.module';
import { BrandMongoModule } from '../../shared/modules/brand.mongo.module';
import { BrandFactory } from './factory/brand.factory';
import { CategoryMongoModule } from '../../shared/modules/category.mongo.module';
import { ProductMongoModule } from '../../shared/modules/product.mongo.module';
import { BrandRepo } from '../../models/brand/brand.repository';

@Module({
  imports: [
    MailModule,
    BrandMongoModule,
    CategoryMongoModule,
    ProductMongoModule,
  ],
  controllers: [BrandController],
  providers: [BrandService, BrandFactory],
  exports: [BrandService],
})
export class BrandModule implements OnModuleInit {
  private readonly logger = new Logger(BrandModule.name);

  constructor(private readonly brandRepo: BrandRepo) {}

  async onModuleInit() {
    try {
      if (this.brandRepo?.model?.collection) {
        const indexes = await this.brandRepo.model.collection.indexes();
        const legacyNameIndex = indexes.find(
          (idx: any) => idx.name === 'name_1' && !idx.partialFilterExpression,
        );
        if (legacyNameIndex) {
          this.logger.log(
            'Dropping legacy unconditional unique index name_1 to apply partialFilterExpression...',
          );
          await this.brandRepo.model.collection.dropIndex('name_1');
          this.logger.log('Syncing brand partial unique index...');
          await this.brandRepo.model.syncIndexes();
          this.logger.log('Brand indexes successfully updated.');
        }
      }
    } catch (error: any) {
      this.logger.warn(`Brand index migration check: ${error?.message}`);
    }
  }
}
