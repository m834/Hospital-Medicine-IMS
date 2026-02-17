import { Injectable } from '@nestjs/common';
import { VisitsService } from '../visits/visits.service';
import { CreateVisitDto, UpdateVisitDto, VisitQueryDto } from './dto';

@Injectable()
export class PatientVisitsService {
  constructor(private readonly visitsService: VisitsService) {}

  create(dto: CreateVisitDto) {
    return this.visitsService.create(dto);
  }

  findAll(query: VisitQueryDto) {
    return this.visitsService.findAll(query);
  }

  findOne(id: string) {
    return this.visitsService.findOne(id);
  }

  update(id: string, dto: UpdateVisitDto, consultantId?: string) {
    return this.visitsService.update(id, dto, consultantId);
  }

  cancel(id: string) {
    return this.visitsService.cancel(id);
  }

  findByPatient(patientId: string, limit?: number) {
    return this.visitsService.findByPatient(patientId, limit);
  }
}
