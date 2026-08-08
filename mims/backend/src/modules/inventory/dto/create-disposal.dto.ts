import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DisposalReason } from '@prisma/client';

export class DisposalItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Batch is required' })
  batchId: string;

  @IsInt()
  @Min(1, { message: 'Quantity to dispose must be at least 1' })
  @Type(() => Number)
  quantity: number;

  @IsEnum(DisposalReason, { message: 'Select a disposal reason' })
  reason: DisposalReason;

  /**
   * Free text. Required when the reason is OTHER, optional detail otherwise.
   *
   * ValidateIf skips every validator on the property when it returns false,
   * which is exactly what we want here: for any other reason the note is
   * unchecked, and for OTHER it must be present. Adding @IsOptional() would
   * cancel the required check and let an "Other" disposal save with no
   * explanation.
   */
  @ValidateIf((o) => o.reason === DisposalReason.OTHER)
  @IsString()
  @IsNotEmpty({ message: 'Describe the reason when choosing Other' })
  note?: string;
}

export class CreateDisposalDto {
  /**
   * Ignored by the service, which reads the owning pharmacy from the batch.
   * Kept optional so existing callers do not break.
   */
  @IsString()
  @IsOptional()
  pharmacyId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DisposalItemDto)
  items: DisposalItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
