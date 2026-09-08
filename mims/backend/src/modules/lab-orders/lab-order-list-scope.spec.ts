import { Test, TestingModule } from '@nestjs/testing';
import { LabOrdersService } from './lab-orders.service';
import { PrismaService } from '@/database/prisma.service';

/**
 * The lab order list is a registration staff member's own desk: they see the
 * tests they ordered and nothing else. Everyone above them works the whole
 * hospital's list.
 */
describe('LabOrdersService list scoping', () => {
  let service: LabOrdersService;

  const mockPrismaService = {
    labOrder: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  /** The `where` Prisma was actually asked for. */
  const whereOf = () =>
    mockPrismaService.labOrder.findMany.mock.calls[0][0].where;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.labOrder.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabOrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LabOrdersService>(LabOrdersService);
  });

  it('shows a registration staff member only their own orders', async () => {
    await service.findAll(
      'hospital-1',
      { status: 'APPROVED' as any },
      { id: 'user-1', role: 'REGISTRATION_STAFF' },
    );

    expect(whereOf()).toEqual(
      expect.objectContaining({ hospitalId: 'hospital-1', orderedById: 'user-1' }),
    );
  });

  it('ignores an orderedById a registration staff member asks for', async () => {
    await service.findAll(
      'hospital-1',
      { orderedById: 'someone-else' },
      { id: 'user-1', role: 'REGISTRATION_STAFF' },
    );

    expect(whereOf().orderedById).toBe('user-1');
  });

  it.each([
    'MASTER_ADMIN',
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'DEPARTMENT_ADMIN',
    'REGISTRATION_STAFF_MANAGER',
    'LAB_TECHNICIAN',
    'DOCTOR',
  ])('shows a %s the whole hospital list', async (role) => {
    await service.findAll('hospital-1', undefined, { id: 'user-2', role });

    expect(whereOf().orderedById).toBeUndefined();
  });

  it('lets a role that sees everything filter by one staff member', async () => {
    await service.findAll(
      'hospital-1',
      { orderedById: 'user-1' },
      { id: 'manager', role: 'REGISTRATION_STAFF_MANAGER' },
    );

    expect(whereOf().orderedById).toBe('user-1');
  });

  it('leaves an unauthenticated internal call unscoped', async () => {
    await service.findAll('hospital-1');

    expect(whereOf().orderedById).toBeUndefined();
  });
});
