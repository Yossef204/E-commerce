import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NodemailerService } from '../providers/nodemailer.service';
import { MAILER_SERVICE } from '../interfaces/mailer.interface';

describe('NodemailerService (DIP Unit Test)', () => {
  let service: NodemailerService;
  let mockTransporter: {
    sendMail: jest.Mock;
  };

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodemailerService,
        {
          provide: MAILER_SERVICE,
          useClass: NodemailerService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'mail') {
                return {
                  host: 'smtp.mailtrap.io',
                  port: 2525,
                  email: 'test@souqna.com',
                  password: 'password123',
                };
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<NodemailerService>(NodemailerService);
    // Replace internal transporter with mock
    (service as any).transporter = mockTransporter;
  });

  it('should be defined and implement IMailerService', () => {
    expect(service).toBeDefined();
    expect(typeof service.send).toBe('function');
  });

  it('should send email using configured transporter', async () => {
    await service.send({
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Test body</p>',
    });

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test body</p>',
      }),
    );
  });

  it('should throw error when transporter fails', async () => {
    mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection error'));

    await expect(
      service.send({
        to: 'fail@example.com',
        subject: 'Fail',
        html: '<p>Fail</p>',
      }),
    ).rejects.toThrow('SMTP connection error');
  });
});

