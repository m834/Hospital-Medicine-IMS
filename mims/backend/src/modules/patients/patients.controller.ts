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
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { SearchPatientsDto } from './dto/search-patients.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR')
  create(@Body() createPatientDto: CreatePatientDto, @CurrentUser() user: any) {
    return this.patientsService.create(createPatientDto, user.id, user.hospitalId);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR', 'DOCTOR_ASSISTANT', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'PHARMACY_STAFF')
  findAll(@Query() searchDto: SearchPatientsDto, @CurrentUser() user: any) {
    // For SUPER_ADMIN, use hospitalId from query params or user's hospitalId
    const hospitalId = searchDto.hospitalId || user.hospitalId;
    return this.patientsService.findAll(searchDto, hospitalId);
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'REGISTRATION_STAFF')
  getStats(@Query('hospitalId') hospitalId: string, @CurrentUser() user: any) {
    // For SUPER_ADMIN, use hospitalId from query params or user's hospitalId
    const targetHospitalId = hospitalId || user.hospitalId;
    return this.patientsService.getStats(targetHospitalId);
  }

  @Get('nr/:nrNumber')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR', 'DOCTOR_ASSISTANT', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'PHARMACY_STAFF')
  findByNRNumber(@Param('nrNumber') nrNumber: string, @Query('hospitalId') hospitalId: string, @CurrentUser() user: any) {
    const targetHospitalId = hospitalId || user.hospitalId;
    return this.patientsService.findByNRNumber(nrNumber, targetHospitalId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR', 'DOCTOR_ASSISTANT', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'PHARMACY_STAFF')
  findOne(@Param('id') id: string, @Query('hospitalId') hospitalId: string, @CurrentUser() user: any) {
    const targetHospitalId = hospitalId || user.hospitalId;
    return this.patientsService.findOne(id, targetHospitalId);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR')
  update(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @CurrentUser() user: any,
  ) {
    return this.patientsService.update(id, updatePatientDto, user.hospitalId);
  }

  @Delete(':id')
  @Roles('HOSPITAL_ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.remove(id, user.hospitalId);
  }
}
