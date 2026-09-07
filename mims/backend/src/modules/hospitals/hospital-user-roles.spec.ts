import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { HospitalsService } from './hospitals.service';
import { PrismaService } from '@/database/prisma.service';

/**
 * Which roles POST /hospitals/:id/users will accept. The list used to be typed
 * out by hand and fell behind the schema, so REGISTRATION_STAFF_MANAGER was
 * offered by the form and refused by the server. These pin the rule to the
 * enum: every role but the two that are not hospital-scoped.
 */
describe('HospitalsService.addUser role validation', () => {
  let service: HospitalsService;

  const mockPrismaService = {
    hospital: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), create: jest.fn() },
    department: { findFirst: jest.fn() },
    pharmacy: { findFirst: jest.fn() },
    subDepartment: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const newUser = (role: UserRole, overrides: Partial<any> = {}) => ({
    email: 'new.staff@hospital.com',
    password: 'Str0ng!Password',
    fullName: 'New Staff',
    role,
    departmentId: 'dept-1',
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.hospital.findUnique.mockResolvedValue({ id: 'hospital-1' });
    mockPrismaService.user.findUnique.mockResolvedValue(null);
    mockPrismaService.department.findFirst.mockResolvedValue({ id: 'dept-1' });
    mockPrismaService.user.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'user-1', ...data }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HospitalsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<HospitalsService>(HospitalsService);
  });

  it('creates a REGISTRATION_STAFF_MANAGER', async () => {
    const user = await service.addUser(
      'hospital-1',
      newUser(UserRole.REGISTRATION_STAFF_MANAGER) as any,
      'admin-1',
    );

    expect(user.role).toBe(UserRole.REGISTRATION_STAFF_MANAGER);
  });

  it('requires a department for a REGISTRATION_STAFF_MANAGER, as the form does', async () => {
    await expect(
      service.addUser(
        'hospital-1',
        newUser(UserRole.REGISTRATION_STAFF_MANAGER, { departmentId: undefined }) as any,
        'admin-1',
      ),
    ).rejects.toThrow(/Department ID is required/);
  });

  // The guard is the enum, so a role added to the schema tomorrow is accepted
  // here without anyone remembering to edit a list.
  it.each(
    Object.values(UserRole).filter(
      (role) => role !== UserRole.MASTER_ADMIN && role !== UserRole.SUPER_ADMIN,
    ),
  )('accepts %s as a hospital role', async (role) => {
    // Pharmacy roles need a pharmacy of the matching type; everyone else does not.
    const pharmacyType = role === UserRole.SUB_PHARMACY_MANAGER ? 'SUB' : 'MAIN';
    mockPrismaService.pharmacy.findFirst.mockResolvedValue({
      id: 'pharm-1',
      type: pharmacyType,
    });

    await expect(
      service.addUser(
        'hospital-1',
        newUser(role, { pharmacyId: 'pharm-1' }) as any,
        'admin-1',
      ),
    ).resolves.toEqual(expect.objectContaining({ role }));
  });

  it.each([UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN])(
    'refuses %s, which is not a hospital role',
    async (role) => {
      await expect(
        service.addUser('hospital-1', newUser(role) as any, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    },
  );
});
