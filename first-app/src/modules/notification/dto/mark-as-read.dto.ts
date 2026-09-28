import { IsNotEmpty, IsString } from 'class-validator';

export class MarkAsReadDto {
  @IsNotEmpty()
  @IsString()
  notificationId: string;
}
