import { IsString, IsOptional, IsEnum, MaxLength, IsNotEmpty } from 'class-validator';
import { DepartmentStatus } from '@prisma/client';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(DepartmentStatus)
  @IsOptional()
  status?: DepartmentStatus;
}
