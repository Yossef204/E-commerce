import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  INotification,
  INotificationPayload,
} from '../interfaces/notification.interface';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SocketIoNotificationProvider
  implements INotification, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SocketIoNotificationProvider.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const userId = client.handshake.query?.userId as string;
    if (userId) {
      const room = `user:${userId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} connected & joined room: ${room}`);
    } else {
      this.logger.log(
        `Client ${client.id} connected (No userId query parameter provided)`,
      );
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: string,
  ) {
    if (userId) {
      const room = `user:${userId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} explicitly joined room: ${room}`);
    }
  }

  public async send(payload: INotificationPayload): Promise<void> {
    const room = `user:${payload.recipientId}`;
    this.logger.log(
      `[Socket.IO Provider] Broadcasting real-time notification to room '${room}': ${payload.title}`,
    );

    if (this.server) {
      this.server.to(room).emit('notification', payload);
      // Also broadcast general event if socket client is listening globally
      this.server.emit('notification_broadcast', payload);
    } else {
      this.logger.warn('WebSocket server is not initialized yet.');
    }
  }

  public async sendBatch(payloads: INotificationPayload[]): Promise<void> {
    for (const payload of payloads) {
      await this.send(payload);
    }
  }
}
