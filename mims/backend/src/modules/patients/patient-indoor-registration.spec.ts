import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PrismaService } from '@/database/prisma.service';
import { VisitsService } from '../visits/visits.service';
import { AdmissionsService } from '../admissions/admissions.service';

/**
 * A Ward/Indoor registration admits the patient to a bed. It either saves the
 * patient, the visit and the admission together, or saves nothing — it never
 * saves the patient and quietly skips the admission, which used to leave the
 * bed shown as available with a patient in it.
 */
describe('PatientsService indoor registration', () => {
  let service: PatientsService;

  // The transaction client is a separate object, so the tests can tell what
  // was written inside the transaction from what was written outside it.
  const tx: any = { patient: { create: jest.fn() } };
  const prisma: any = {
    patient: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    user: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const visitsService = { create: jest.fn() };
  const admissionsService = { create: jest.fn() };

  const indoor = {
    fullName: 'Ali Khan',
    visitType: 'WARD_INDOOR',
    department: 'dept-1',
    attendingDoctorId: 'doctor-1',
    ward: 'room-1',
    bed: 'bed-1',
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: any) => any) => fn(tx));
    prisma.user.findFirst.mockResolvedValue({ id: 'doctor-1', role: 'DOCTOR' });
    prisma.patient.findFirst.mockResolvedValue(null); // MRN code is free
    tx.patient.create.mockResolvedValue({ id: 'patient-1', nrNumber: 'MRN-20261005-482913' });
    prisma.patient.create.mockResolvedValue({ id: 'patient-2', nrNumber: 'MRN-20261005-111111' });
    visitsService.create.mockResolvedValue({ visit: { id: 'visit-1' } });
    admissionsService.create.mockResolvedValue({ id: 'admission-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: prisma },
        { provide: VisitsService, useValue: visitsService },
        { provide: AdmissionsService, useValue: admissionsService },
      ],
    }).compile();

    service = module.get(PatientsService);
  });

  describe('a missing field refuses the registration before anything is saved', () => {
    it.each([
      ['department', { department: undefined }],
      ['attending doctor', { attendingDoctorId: undefined }],
      ['room', { ward: undefined }],
      ['bed', { bed: undefined }],
    ])('without the %s', async (field, override) => {
      const attempt = service.create({ ...indoor, ...override }, 'user-1', 'hospital-1');

      await expect(attempt).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ ...indoor, ...override }, 'user-1', 'hospital-1'),
      ).rejects.toThrow(field);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.patient.create).not.toHaveBeenCalled();
      expect(tx.patient.create).not.toHaveBeenCalled();
      expect(visitsService.create).not.toHaveBeenCalled();
      expect(admissionsService.create).not.toHaveBeenCalled();
    });
  });

  it('saves the patient, the visit and the admission in one transaction', async () => {
    await service.create(indoor, 'user-1', 'hospital-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.patient.create).toHaveBeenCalledTimes(1);
    expect(prisma.patient.create).not.toHaveBeenCalled();
    expect(visitsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ visitType: 'WARD_INDOOR', bedId: 'bed-1', wardId: 'room-1' }),
      tx,
    );
    expect(admissionsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        visitId: 'visit-1',
        roomId: 'room-1',
        bedId: 'bed-1',
        departmentId: 'dept-1',
        attendingDoctorId: 'doctor-1',
      }),
      tx,
    );
  });

  it('fails the whole registration when the admission is refused', async () => {
    admissionsService.create.mockRejectedValue(
      new ConflictException('Selected bed was just taken by another admission.'),
    );

    await expect(service.create(indoor, 'user-1', 'hospital-1')).rejects.toThrow(
      'Selected bed was just taken',
    );
    // The patient was written only inside the transaction that failed, so the
    // database rolls it back with the rest.
    expect(prisma.patient.create).not.toHaveBeenCalled();
  });

  it('admits a returning patient in one transaction too', async () => {
    prisma.patient.findFirst.mockResolvedValueOnce({ id: 'patient-9', nrNumber: 'MRN-1' });

    const patient = await service.create(
      { ...indoor, cnic: '12345-1234567-1' },
      'user-1',
      'hospital-1',
    );

    expect(patient.id).toBe('patient-9');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(visitsService.create).toHaveBeenCalledWith(expect.anything(), tx);
    expect(admissionsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'patient-9' }),
      tx,
    );
  });

  it('leaves OPD registration as it was — no transaction, no admission', async () => {
    await service.create({ fullName: 'Sana Iqbal', visitType: 'OPD' } as any, 'user-1', 'hospital-1');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.patient.create).toHaveBeenCalledTimes(1);
    expect(visitsService.create).toHaveBeenCalledWith(expect.anything(), undefined);
    expect(admissionsService.create).not.toHaveBeenCalled();
  });
});
