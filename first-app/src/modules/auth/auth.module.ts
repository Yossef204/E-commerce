import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { SessionMongoModule } from '../../shared/modules/session.mongo.module';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from '../../shared/mailer/mail.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ResetTokenGuard } from './guards/reset-token.guard';

@Module({
  imports: [
    MailModule,
    UserMongoModule,
    SessionMongoModule,
    SellingEntityMongoModule,
    PermissionsModule,
    JwtModule.registerAsync({
      global: true, // 1. يجعله متاحاً تلقائياً لكل الحراس (Guards) في كافة الموديولات (بما فيها PermissionsModule)
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') ||
          configService.get<any>('jwt')?.accessSecret ||
          configService.get<string>('jwt.accessSecret') ||
          process.env.ACCESS_TOKEN_SECRET ||
          'default_jwt_secret_fallback',
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ResetTokenGuard],
  exports: [AuthService, JwtModule, ResetTokenGuard], // 2. تصديره صراحة
})
export class AuthModule {}
