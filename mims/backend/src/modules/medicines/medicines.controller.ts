import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { SearchMedicinesDto } from './dto/search-medicines.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('medicines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
  )
  create(@Body() createMedicineDto: CreateMedicineDto, @Request() req) {
    // Use hospitalId from DTO (Super Admin) or from user (others)
    const hospitalId = createMedicineDto.hospitalId || req.user.hospitalId;
    return this.medicinesService.create(createMedicineDto, hospitalId);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.DOCTOR,
  )
  findAll(@Query() searchDto: SearchMedicinesDto, @Request() req) {
    // Super Admin can query all hospitals or specific hospital via query param
    const hospitalId = req.user.hospitalId || searchDto.hospitalId;
    return this.medicinesService.findAll(searchDto, hospitalId);
  }

  @Get('stats')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  getStats(@Query('hospitalId') hospitalId: string, @Request() req) {
    // Use query param hospitalId for Super Admin, or user's hospitalId for others
    const targetHospitalId = req.user.hospitalId || hospitalId;
    return this.medicinesService.getStats(targetHospitalId);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.DOCTOR,
  )
  findOne(@Param('id') id: string, @Request() req) {
    return this.medicinesService.findOne(id, req.user.hospitalId);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  update(
    @Param('id') id: string,
    @Body() updateMedicineDto: UpdateMedicineDto,
    @Request() req,
  ) {
    return this.medicinesService.update(id, updateMedicineDto, req.user.hospitalId);
  }

  @Delete(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  remove(@Param('id') id: string, @Request() req) {
    return this.medicinesService.remove(id, req.user.hospitalId);
  }
}
