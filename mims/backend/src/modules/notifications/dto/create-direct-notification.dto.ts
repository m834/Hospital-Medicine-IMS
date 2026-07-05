import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateDirectNotificationDto {
  @IsString()
  @IsNotEmpty({ message: 'A recipient is required' })
  recipientId: string;

  @IsString()
  @IsNotEmpty({ message: 'A title is required' })
  @MaxLength(150)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'A message is required' })
  @MaxLength(1000)
  message: string;
}
