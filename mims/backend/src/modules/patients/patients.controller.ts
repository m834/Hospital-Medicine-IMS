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
  @Roles('HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR')
  create(@Body() createPatientDto: CreatePatientDto, @CurrentUser() user: any) {
    return this.patientsService.create(createPatientDto, user.id, user.hospitalId);
  }

  @Get()
  @Roles('HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR', 'PHARMACIST')
  findAll(@Query() searchDto: SearchPatientsDto, @CurrentUser() user: any) {
    return this.patientsService.findAll(searchDto, user.hospitalId);
  }

  @Get('stats')
  @Roles('HOSPITAL_ADMIN', 'REGISTRATION_STAFF')
  getStats(@CurrentUser() user: any) {
    return this.patientsService.getStats(user.hospitalId);
  }

  @Get('nr/:nrNumber')
  @Roles('HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR', 'PHARMACIST')
  findByNRNumber(@Param('nrNumber') nrNumber: string, @CurrentUser() user: any) {
    return this.patientsService.findByNRNumber(nrNumber, user.hospitalId);
  }

  @Get(':id')
  @Roles('HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR', 'PHARMACIST')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.findOne(id, user.hospitalId);
  }

  @Patch(':id')
  @Roles('HOSPITAL_ADMIN', 'REGISTRATION_STAFF', 'DOCTOR')
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
