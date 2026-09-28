import { Module } from '@nestjs/common';
import { SocketIoNotificationProvider } from './providers/socket-io.provider';
import { NOTIFICATION_PROVIDER } from './tokens/notification.tokens';

@Module({
  providers: [
    SocketIoNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      useExisting: SocketIoNotificationProvider,
    },
  ],
  exports: [NOTIFICATION_PROVIDER, SocketIoNotificationProvider],
})
export class SharedNotificationModule {}
