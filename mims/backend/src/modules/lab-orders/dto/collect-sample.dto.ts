import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
} from 'class-validator';

export class CollectSampleDto {
  @IsUUID()
  @IsNotEmpty()
  sampleCollectedById: string;

  @IsString()
  @IsOptional()
  sampleType?: string;

  @IsString()
  @IsOptional()
  sampleNotes?: string;
}
