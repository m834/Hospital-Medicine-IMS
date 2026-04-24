import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PriceType } from '@prisma/client';

class IssueItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Medicine ID is required' })
  medicineId: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;

  @IsBoolean()
  @IsOptional()
  dispenseByTablet?: boolean; // true = qty in tablets; false = qty in strips (deduct qty × tabletsPerStrip)

  @IsNumber()
  @IsOptional()
  customPrice?: number;
}

export class CreateIssuanceDto {
  @IsString()
  @IsNotEmpty({ message: 'Patient MRN is required' })
  nrNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Pharmacy ID is required' })
  pharmacyId: string;

  @IsString()
  @IsOptional()
  prescriptionId?: string;

  @IsEnum(PriceType, { message: 'Invalid price type' })
  priceType: PriceType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueItemDto)
  items: IssueItemDto[];
}
