import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { SearchPrescriptionsDto } from './dto/search-prescriptions.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-prescription-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.DOCTOR_ASSISTANT,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  create(@Body() createPrescriptionDto: CreatePrescriptionDto, @Request() req) {
    return this.prescriptionsService.create(createPrescriptionDto, req.user);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.DOCTOR_ASSISTANT,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  findAll(@Query() searchDto: SearchPrescriptionsDto) {
    return this.prescriptionsService.findAll(searchDto);
  }

  @Get('patient/:nrNumber')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.DOCTOR_ASSISTANT,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  getByPatient(@Param('nrNumber') nrNumber: string) {
    return this.prescriptionsService.getByPatient(nrNumber);
  }

  @Get('patient/:nrNumber/active')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.DOCTOR_ASSISTANT,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  getActivePrescriptions(@Param('nrNumber') nrNumber: string) {
    return this.prescriptionsService.getActivePrescriptions(nrNumber);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.DOCTOR_ASSISTANT,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  findOne(@Param('id') id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.DOCTOR_ASSISTANT,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdatePrescriptionStatusDto,
    @Request() req,
  ) {
    return this.prescriptionsService.updateStatus(id, updateStatusDto, req.user);
  }
}
