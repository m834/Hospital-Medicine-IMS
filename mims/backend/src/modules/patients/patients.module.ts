import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { DatabaseModule } from '../../database/database.module';
import { VisitsModule } from '../visits/visits.module';
import { AdmissionsModule } from '../admissions/admissions.module';

@Module({
  imports: [DatabaseModule, VisitsModule, AdmissionsModule],
  providers: [PatientsService],
  controllers: [PatientsController],
  exports: [PatientsService],
})
export class PatientsModule {}
