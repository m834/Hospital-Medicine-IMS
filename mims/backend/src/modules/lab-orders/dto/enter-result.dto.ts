import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsObject,
  IsArray,
} from 'class-validator';

export class EnterResultDto {
  @IsUUID()
  @IsNotEmpty()
  resultsEnteredById: string;

  @IsNotEmpty()
  results: any; // Can be object or array of results

  @IsString()
  @IsOptional()
  resultNotes?: string;

  @IsArray()
  @IsOptional()
  resultFiles?: any[];
}
