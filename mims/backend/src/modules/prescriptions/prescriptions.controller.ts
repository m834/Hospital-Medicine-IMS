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
import { AddPrescriptionMedicineDto } from './dto/add-prescription-medicine.dto';
import { CreatePrescriptionDispatchDto } from './dto/create-prescription-dispatch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

const ALL_PRESCRIPTION_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.DOCTOR,
  UserRole.DOCTOR_ASSISTANT,
  UserRole.MAIN_PHARMACY_MANAGER,
  UserRole.PHARMACY_STAFF,
  UserRole.SUB_PHARMACY_MANAGER,
];

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @Roles(...ALL_PRESCRIPTION_ROLES)
  create(@Body() createPrescriptionDto: CreatePrescriptionDto, @Request() req) {
    return this.prescriptionsService.create(createPrescriptionDto, req.user);
  }

  @Get()
  @Roles(...ALL_PRESCRIPTION_ROLES)
  findAll(@Query() searchDto: SearchPrescriptionsDto) {
    return this.prescriptionsService.findAll(searchDto);
  }

  @Get('patient/:nrNumber')
  @Roles(...ALL_PRESCRIPTION_ROLES)
  getByPatient(@Param('nrNumber') nrNumber: string) {
    return this.prescriptionsService.getByPatient(nrNumber);
  }

  @Get('patient/:nrNumber/active')
  @Roles(...ALL_PRESCRIPTION_ROLES)
  getActivePrescriptions(@Param('nrNumber') nrNumber: string) {
    return this.prescriptionsService.getActivePrescriptions(nrNumber);
  }

  @Get(':id')
  @Roles(...ALL_PRESCRIPTION_ROLES)
  findOne(@Param('id') id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(...ALL_PRESCRIPTION_ROLES)
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdatePrescriptionStatusDto,
    @Request() req,
  ) {
    return this.prescriptionsService.updateStatus(id, updateStatusDto, req.user);
  }

  @Post(':id/medicines')
  @Roles(...ALL_PRESCRIPTION_ROLES)
  addMedicine(
    @Param('id') id: string,
    @Body() dto: AddPrescriptionMedicineDto,
    @Request() req,
  ) {
    return this.prescriptionsService.addMedicine(id, dto, req.user.id);
  }

  @Post(':id/dispatch')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  dispatchRound(
    @Param('id') id: string,
    @Body() dto: CreatePrescriptionDispatchDto,
    @Request() req,
  ) {
    return this.prescriptionsService.dispatchRound(id, dto, req.user);
  }

  @Patch(':id/complete')
  @Roles(...ALL_PRESCRIPTION_ROLES)
  completePrescription(@Param('id') id: string) {
    return this.prescriptionsService.completePrescription(id);
  }
}
