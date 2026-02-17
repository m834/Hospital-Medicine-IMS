import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
} from 'class-validator';

export class ApproveResultDto {
  @IsUUID()
  @IsNotEmpty()
  resultsApprovedById: string;

  @IsString()
  @IsOptional()
  approvalNotes?: string;
}
