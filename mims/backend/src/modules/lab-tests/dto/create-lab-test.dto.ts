import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  IsEnum,
  IsObject,
  Min,
} from 'class-validator';
import { LabTestStatus } from '@prisma/client';

export class CreateLabTestDto {
  @IsUUID()
  @IsNotEmpty()
  hospitalId: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  subDepartmentId?: string;

  @IsString()
  @IsNotEmpty()
  testCode: string;

  @IsString()
  @IsNotEmpty()
  testName: string;

  @IsString()
  @IsNotEmpty()
  testCategory: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  turnaroundTime?: string;

  @IsString()
  @IsOptional()
  requirements?: string;

  @IsObject()
  @IsOptional()
  normalRange?: any;

  @IsEnum(LabTestStatus)
  @IsOptional()
  status?: LabTestStatus;
}
