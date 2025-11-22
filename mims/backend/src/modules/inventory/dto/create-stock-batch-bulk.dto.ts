import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsEnum,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StorageType, MedicineForm } from '@prisma/client';

export class BulkStockBatchItemDto {
  // Medicine identification - use name OR medicineId
  @IsString()
  @IsOptional()
  medicineId?: string;

  @IsString()
  @IsOptional()
  medicineName?: string;

  @IsString()
  @IsOptional()
  genericName?: string;

  @IsEnum(MedicineForm)
  @IsOptional()
  form?: MedicineForm;

  @IsString()
  @IsOptional()
  strength?: string;

  @IsString()
  @IsOptional()
  medicineManufacturer?: string; // For medicine creation

  // Pharmacy identification
  @IsString()
  @IsNotEmpty({ message: 'Pharmacy ID is required' })
  pharmacyId: string;

  // Batch details
  @IsString()
  @IsNotEmpty({ message: 'Batch number is required' })
  batchNo: string;

  @IsInt()
  @Min(1, { message: 'Quantity received must be at least 1' })
  qtyReceived: number;

  @IsDateString()
  @IsNotEmpty({ message: 'Expiry date is required' })
  expiryDate: string;

  @IsString()
  @IsOptional()
  manufacturer?: string; // Batch manufacturer (can be different from medicine manufacturer)

  @IsEnum(StorageType, { message: 'Invalid storage type' })
  storageType: StorageType;

  @IsNumber()
  @Min(0, { message: 'Purchase price must be non-negative' })
  purchasePrice: number;

  @IsNumber()
  @Min(0, { message: 'Government price must be non-negative' })
  governmentPrice: number;

  @IsNumber()
  @Min(0, { message: 'Retail price must be non-negative' })
  retailPrice: number;

  @IsDateString()
  @IsOptional()
  receivedDate?: string;
}

export class BulkCreateStockBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStockBatchItemDto)
  batches: BulkStockBatchItemDto[];

  @IsString()
  @IsNotEmpty({ message: 'Hospital ID is required' })
  hospitalId: string;
}
