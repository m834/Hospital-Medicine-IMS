import { IsString, IsOptional, IsEnum, MaxLength, IsNotEmpty } from 'class-validator';
import { SubDepartmentStatus } from '@prisma/client';

export class CreateSubDepartmentDto {
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

  @IsEnum(SubDepartmentStatus)
  @IsOptional()
  status?: SubDepartmentStatus;
}
