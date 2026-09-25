import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionRepo } from '../../models/session/session.repository';
import { Session, SessionSchema } from '../../models/session/session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Session.name,
        schema: SessionSchema,
      },
    ]),
  ],
  controllers: [],
  providers: [SessionRepo],
  exports: [SessionRepo],
})
export class SessionMongoModule {}

