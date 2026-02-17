import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  Min,
  Matches,
} from 'class-validator';
import { ClinicStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateClinicDto {
  @IsUUID()
  @IsNotEmpty()
  hospitalId: string;

  @IsUUID()
  @IsNotEmpty()
  departmentId: string;

  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  opdFee: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  availableDays?: string[]; // ["MONDAY", "WEDNESDAY", "FRIDAY"]

  @IsString()
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'availableFrom must be in HH:mm format',
  })
  availableFrom?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'availableTo must be in HH:mm format',
  })
  availableTo?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  maxPatientsPerDay?: number;

  @IsEnum(ClinicStatus)
  @IsOptional()
  status?: ClinicStatus;
}
