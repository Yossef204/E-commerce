import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { IMailerService, SendMailOptions } from '../interfaces/mailer.interface';

@Injectable()
export class NodemailerService implements IMailerService {
  private readonly logger = new Logger(NodemailerService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const mailConfig = this.configService.get<any>('mail') || {};
    const host = mailConfig.host || process.env.MAIL_HOST || 'smtp.gmail.com';
    const port = Number(mailConfig.port || process.env.MAIL_PORT || 465);
    const user = mailConfig.email || process.env.EMAIL || '';
    const pass = mailConfig.password || process.env.PASSWORD_EMAIL_NODEMAILER || '';
    const secure = port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    const mailConfig = this.configService.get<any>('mail') || {};
    const from =
      options.from ||
      (mailConfig.email
        ? `"No Reply" <${mailConfig.email}>`
        : '"No Reply" <noreply@souqna.com>');

    try {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      this.logger.log(`Email successfully dispatched to ${options.to}`);
    } catch (err: any) {
      this.logger.warn(`Nodemailer delivery error to ${options.to}: ${err.message}`);
      throw err;
    }
  }
}

