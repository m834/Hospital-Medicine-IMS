import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for generating detailed daily transaction report
 * Includes medicine-wise breakdown of all transactions
 */
export class DetailedDailyReportDto {
  @IsString()
  @IsNotEmpty()
  pharmacyId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  hospitalId?: string;
}

/**
 * DTO for medicine-wise stock ledger
 */
export class MedicineStockLedgerDto {
  @IsString()
  @IsNotEmpty()
  pharmacyId: string;

  @IsString()
  @IsOptional()
  medicineId?: string; // Optional: filter by specific medicine

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  hospitalId?: string;
}

/**
 * DTO for medicine consumption summary
 */
export class MedicineConsumptionDto {
  @IsString()
  @IsNotEmpty()
  pharmacyId: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  hospitalId?: string;
}
