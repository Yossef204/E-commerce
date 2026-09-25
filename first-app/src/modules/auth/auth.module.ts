import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { SessionMongoModule } from '../../shared/modules/session.mongo.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailModule } from '../../shared/mailer/mail.module';

@Module({
  imports: [
    MailModule,
    UserMongoModule,
    SessionMongoModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt').accessSecret as string,
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
