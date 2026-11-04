import { Inject, Injectable } from '@nestjs/common';
import {
  IMailerService,
  MAILER_SERVICE,
  SendMailOptions,
} from './interfaces/mailer.interface';

@Injectable()
export class MailService implements IMailerService {
  constructor(
    @Inject(MAILER_SERVICE) private readonly mailer: IMailerService,
  ) {}

  async send(options: SendMailOptions): Promise<void> {
    await this.mailer.send(options);
  }
}
