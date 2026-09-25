import { Module } from '@nestjs/common';
import { UserRepo } from '../../models/user/user.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { User, userSchema } from '../../models/user/user.schema';
import { Admin, adminSchema } from '../../models/admin/admin.schema';
import { Seller, sellerSchema } from '../../models/seller/seller.schema';
import {
  Customer,
  customerSchema,
} from '../../models/customer/customer.schema';
import { SellerRepo } from '../../models/seller/seller.repository';
import { AdminRepo } from '../../models/admin/admin.repository';
import { CustomerRepo } from '../../models/customer/customer.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: userSchema,
        discriminators: [
          { name: Admin.name, schema: adminSchema },
          { name: Seller.name, schema: sellerSchema },
          { name: Customer.name, schema: customerSchema },
        ],
      },
    ]),
  ],
  controllers: [],
  providers: [UserRepo, SellerRepo, AdminRepo, CustomerRepo],
  exports: [UserRepo, SellerRepo, AdminRepo, CustomerRepo],
})
export class UserMongoModule {}
