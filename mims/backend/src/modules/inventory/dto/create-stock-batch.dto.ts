import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsEnum,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StorageType, MedicineForm } from '@prisma/client';

export class CreateStockBatchDto {
  // Medicine identification - provide either medicineId OR medicineName+form
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
  medicineManufacturer?: string; // For medicine creation if not found

  @IsString()
  @IsNotEmpty({ message: 'Pharmacy ID is required' })
  pharmacyId: string;

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
  manufacturer?: string;

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

  // ---- Unit-based tracking fields ----

  @IsString()
  @IsOptional()
  purchaseUnit?: string; // e.g., Box, Bottle, Carton

  @IsNumber()
  @Min(0, { message: 'Purchase unit price must be non-negative' })
  @IsOptional()
  @Type(() => Number)
  purchaseUnitPrice?: number; // price per purchase unit

  @IsInt()
  @Min(1, { message: 'Units per purchase unit must be at least 1' })
  @IsOptional()
  @Type(() => Number)
  unitsPerPurchaseUnit?: number; // e.g., 1 Box = 10 Strips

  @IsString()
  @IsOptional()
  subUnit?: string; // e.g., Strip, Vial (middle level)

  @IsInt()
  @Min(1, { message: 'Units per sub unit must be at least 1' })
  @IsOptional()
  @Type(() => Number)
  unitsPerSubUnit?: number; // e.g., 1 Strip = 10 Tablets

  @IsString()
  @IsOptional()
  dispensingUnit?: string; // e.g., Tablet, ml, Vial

  @IsInt()
  @Min(1, { message: 'Quantity received in purchase units must be at least 1' })
  @IsOptional()
  @Type(() => Number)
  qtyReceivedPurchase?: number; // quantity received in purchase units

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  reorderLevel?: number; // minimum dispensing units before alert triggers

  @IsDateString()
  @IsOptional()
  receivedDate?: string;
}
