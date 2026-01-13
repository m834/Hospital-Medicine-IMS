import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  resource: string;

  @IsString()
  @IsIn(['read', 'write', 'delete', 'approve'])
  action: string;

  @IsString()
  @IsIn(['all', 'own', 'own_pharmacy', 'own_department'])
  scope: string;

  @IsString()
  @IsOptional()
  description?: string;
}
