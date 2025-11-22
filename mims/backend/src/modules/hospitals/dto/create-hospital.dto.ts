import { IsString, IsNotEmpty, IsEmail, IsEnum, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateHospitalDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z0-9]+$/, { message: 'Hospital code must be uppercase alphanumeric' })
  code: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  address: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  phone: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}
