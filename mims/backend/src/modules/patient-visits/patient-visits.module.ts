import { Module } from '@nestjs/common';
import { PatientVisitsController } from './patient-visits.controller';
import { PatientVisitsService } from './patient-visits.service';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [VisitsModule],
  controllers: [PatientVisitsController],
  providers: [PatientVisitsService],
})
export class PatientVisitsModule {}
