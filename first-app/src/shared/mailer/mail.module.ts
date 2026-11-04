import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MAILER_SERVICE } from './interfaces/mailer.interface';
import { NodemailerService } from './providers/nodemailer.service';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    NodemailerService,
    {
      provide: MAILER_SERVICE,
      useClass: NodemailerService,
    },
    MailService,
  ],
  exports: [MAILER_SERVICE, MailService, NodemailerService],
})
export class MailModule {}
