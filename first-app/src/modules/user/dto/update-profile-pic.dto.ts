import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateProfilePicDto {
  @IsString()
  @IsNotEmpty()
  profilePic: string;
}
