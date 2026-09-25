import { ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get('mail').host as string,
          port: configService.get('mail').port || 456,
          auth: {
            user: configService.get('mail').email as string,
            pass: configService.get('mail').password as string,
          },
        },
        defaults: {
          from: `"No Reply" <${configService.get('mail').email as string}>`,
        },
      }),
    }),
  ],
  controllers: [],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
