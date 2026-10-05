import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdmissionsService } from './admissions.service';
import { PrismaService } from '@/database/prisma.service';

/**
 * Admitting a patient must occupy their bed, and only a free bed can be
 * occupied. A room follows its beds: full only when every bed is taken.
 */
describe('AdmissionsService bed occupancy', () => {
  let service: AdmissionsService;

  const rate = new Prisma.Decimal(500);
  const room = { id: 'room-1', hospitalId: 'hospital-1', status: 'AVAILABLE', dailyRate: rate };
  const bed = {
    id: 'bed-1',
    hospitalId: 'hospital-1',
    roomId: 'room-1',
    status: 'AVAILABLE',
    dailyRate: rate,
  };

  const dto = {
    hospitalId: 'hospital-1',
    patientId: 'patient-1',
    visitId: 'visit-1',
    departmentId: 'dept-1',
    roomId: 'room-1',
    bedId: 'bed-1',
    attendingDoctorId: 'doctor-1',
    admittingUserId: 'user-1',
    admissionType: 'PLANNED' as any,
  };

  // One mock client stands in for both the service's prisma and the
  // transaction client; $transaction hands it to the callback.
  const db: any = {
    hospital: { findUnique: jest.fn() },
    patient: { findUnique: jest.fn() },
    department: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    admission: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    room: { findUnique: jest.fn(), update: jest.fn() },
    bed: { findUnique: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
    dailyCharge: { create: jest.fn() },
    receipt: { findFirst: jest.fn(), create: jest.fn() },
    labOrder: { findMany: jest.fn() },
    issueTransaction: { findMany: jest.fn() },
    visit: { findUnique: jest.fn() },
    operation: { findMany: jest.fn() },
    $transaction: jest.fn((fn: (tx: any) => any) => fn(db)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    db.$transaction.mockImplementation((fn: (tx: any) => any) => fn(db));

    db.hospital.findUnique.mockResolvedValue({ id: 'hospital-1' });
    db.patient.findUnique.mockResolvedValue({ id: 'patient-1' });
    db.department.findUnique.mockResolvedValue({ id: 'dept-1' });
    db.user.findUnique.mockResolvedValue({ id: 'someone' });
    db.admission.findFirst.mockResolvedValue(null);
    db.admission.findUnique.mockResolvedValue(null); // admission number is free
    db.admission.create.mockResolvedValue({ id: 'admission-1' });
    db.room.findUnique.mockResolvedValue(room);
    db.bed.findUnique.mockResolvedValue(bed);
    db.bed.updateMany.mockResolvedValue({ count: 1 });
    // Room of two beds, one still free after this admission.
    db.bed.count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.status ? 1 : 2),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdmissionsService, { provide: PrismaService, useValue: db }],
    }).compile();

    service = module.get(AdmissionsService);
  });

  describe('admitting', () => {
    it('occupies the bed, only if it is still free', async () => {
      await service.create(dto);

      expect(db.bed.updateMany).toHaveBeenCalledWith({
        where: { id: 'bed-1', status: 'AVAILABLE' },
        data: { status: 'OCCUPIED' },
      });
    });

    it('saves the admission and the bed in the transaction it is given', async () => {
      const tx = db;
      await service.create(dto, tx);

      // Inside a caller's transaction it opens none of its own.
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.admission.create).toHaveBeenCalled();
      expect(db.bed.updateMany).toHaveBeenCalled();
    });

    it('refuses the admission when another desk took the bed first', async () => {
      db.bed.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('refuses a bed that is already occupied', async () => {
      db.bed.findUnique.mockResolvedValue({ ...bed, status: 'OCCUPIED' });

      await expect(service.create(dto)).rejects.toThrow('Selected bed is not available');
      expect(db.admission.create).not.toHaveBeenCalled();
    });

    it('refuses a bed that is not in the chosen room', async () => {
      db.bed.findUnique.mockResolvedValue({ ...bed, roomId: 'room-2' });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(db.admission.create).not.toHaveBeenCalled();
    });

    it('refuses a patient who is already admitted', async () => {
      db.admission.findFirst.mockResolvedValue({ id: 'admission-0' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(db.bed.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('rooms follow their beds', () => {
    it('takes a ward the old code had flagged occupied while it has a free bed', async () => {
      db.room.findUnique.mockResolvedValue({ ...room, status: 'OCCUPIED' });

      await expect(service.create(dto)).resolves.toBeDefined();
      // One bed of two still free: the room is available again.
      expect(db.room.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { status: 'AVAILABLE' },
      });
    });

    it('leaves a room with a free bed available', async () => {
      await service.create(dto);

      expect(db.room.update).not.toHaveBeenCalled();
    });

    it('marks the room occupied when its last bed is taken', async () => {
      db.bed.count.mockImplementation(({ where }: any) => Promise.resolve(where.status ? 0 : 2));

      await service.create(dto);

      expect(db.room.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { status: 'OCCUPIED' },
      });
    });

    it('refuses a room under maintenance', async () => {
      db.room.findUnique.mockResolvedValue({ ...room, status: 'MAINTENANCE' });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(db.admission.create).not.toHaveBeenCalled();
    });
  });

  describe('discharging', () => {
    beforeEach(() => {
      db.admission.findUnique.mockResolvedValue({
        id: 'admission-1',
        status: 'ADMITTED',
        hospitalId: 'hospital-1',
        patientId: 'patient-1',
        departmentId: 'dept-1',
        visitId: null,
        bedId: 'bed-1',
        roomId: 'room-1',
        admittedAt: new Date('2026-10-01'),
        admissionNumber: 'ADM-1',
        dailyCharges: [],
        bed,
        room,
        patient: { nrNumber: 'MRN-1' },
      });
      db.user.findUnique.mockResolvedValue({ id: 'user-1' });
      db.admission.update.mockResolvedValue({ id: 'admission-1' });
      db.operation.findMany.mockResolvedValue([]);
      db.labOrder.findMany.mockResolvedValue([]);
      db.issueTransaction.findMany.mockResolvedValue([]);
      db.receipt.findFirst.mockResolvedValue(null);
      db.receipt.create.mockResolvedValue({ id: 'receipt-1' });
      db.room.findUnique.mockResolvedValue({ ...room, status: 'OCCUPIED' });
    });

    it('gives the bed back', async () => {
      await service.discharge('admission-1', {
        dischargingUserId: 'user-1',
        dischargedAt: '2026-10-05T10:00:00Z',
      } as any);

      expect(db.bed.updateMany).toHaveBeenCalledWith({
        where: { id: 'bed-1', status: 'OCCUPIED' },
        data: { status: 'AVAILABLE' },
      });
    });

    it('keeps the room occupied while its other beds are still taken', async () => {
      db.bed.count.mockImplementation(({ where }: any) => Promise.resolve(where.status ? 0 : 2));

      await service.discharge('admission-1', {
        dischargingUserId: 'user-1',
        dischargedAt: '2026-10-05T10:00:00Z',
      } as any);

      expect(db.room.update).not.toHaveBeenCalled();
    });
  });

  describe('moving to another bed', () => {
    beforeEach(() => {
      db.admission.findUnique.mockResolvedValue({
        id: 'admission-1',
        status: 'ADMITTED',
        hospitalId: 'hospital-1',
        bedId: 'bed-1',
        roomId: 'room-1',
      });
      db.bed.findUnique.mockResolvedValue({ ...bed, id: 'bed-2' });
      db.admission.update.mockResolvedValue({ id: 'admission-1' });
    });

    it('takes the new bed before freeing the old one', async () => {
      await service.update('admission-1', { bedId: 'bed-2' } as any);

      expect(db.bed.updateMany.mock.calls).toEqual([
        [{ where: { id: 'bed-2', status: 'AVAILABLE' }, data: { status: 'OCCUPIED' } }],
        [{ where: { id: 'bed-1', status: 'OCCUPIED' }, data: { status: 'AVAILABLE' } }],
      ]);
    });

    it('keeps the patient in the old bed when the new one was just taken', async () => {
      db.bed.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.update('admission-1', { bedId: 'bed-2' } as any)).rejects.toThrow(
        ConflictException,
      );
      expect(db.bed.updateMany).toHaveBeenCalledTimes(1);
    });
  });
});
