import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(UserRole, { message: 'Invalid user role' })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;

  @IsUUID('4', { message: 'Invalid hospital ID' })
  @IsOptional() // Optional for SUPER_ADMIN, required for other roles (validated in service)
  hospitalId?: string;

  @IsUUID('4', { message: 'Invalid pharmacy ID' })
  @IsOptional()
  pharmacyId?: string;
}

