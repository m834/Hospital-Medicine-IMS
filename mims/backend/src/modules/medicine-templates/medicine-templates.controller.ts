import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MedicineTemplatesService } from './medicine-templates.service';
import { CreateMedicineTemplateDto } from './dto/create-medicine-template.dto';
import { UpdateMedicineTemplateDto } from './dto/update-medicine-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

// Pharmacists and admins can create/manage templates.
const MANAGE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.MAIN_PHARMACY_MANAGER,
  UserRole.SUB_PHARMACY_MANAGER,
  UserRole.PHARMACY_STAFF,
];

// Anyone who can build a prescription may read templates (to apply them).
const READ_ROLES = [...MANAGE_ROLES, UserRole.DOCTOR, UserRole.DOCTOR_ASSISTANT];

@Controller('medicine-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicineTemplatesController {
  constructor(private readonly service: MedicineTemplatesService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreateMedicineTemplateDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @Roles(...READ_ROLES)
  findAll(@Request() req, @Query('hospitalId') hospitalId?: string) {
    return this.service.findAll(req.user, hospitalId);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateMedicineTemplateDto, @Request() req) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(id, req.user);
  }
}
