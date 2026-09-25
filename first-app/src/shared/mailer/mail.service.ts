import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}
  async send(options: ISendMailOptions) {
    await this.mailerService.sendMail(options);
  }
}
