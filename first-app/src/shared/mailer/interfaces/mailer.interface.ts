export const MAILER_SERVICE = Symbol('MAILER_SERVICE');

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface IMailerService {
  send(options: SendMailOptions): Promise<void>;
}

