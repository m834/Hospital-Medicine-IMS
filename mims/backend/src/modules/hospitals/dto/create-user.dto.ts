import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

/**
 * DTO for creating a user within a hospital context
 * Note: SUPER_ADMIN role is NOT allowed here - only hospital-related roles
 */
export class CreateHospitalUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  fullName: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Please provide a valid phone number',
  })
  phone?: string;

  @IsEnum(UserRole, { message: 'Invalid user role' })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;

  @IsUUID('4', { message: 'Invalid pharmacy ID' })
  @IsOptional()
  pharmacyId?: string;

  @IsUUID('4', { message: 'Invalid department ID' })
  @IsOptional()
  departmentId?: string;

  @IsUUID('4', { message: 'Invalid sub-department ID' })
  @IsOptional()
  subDepartmentId?: string;
}
