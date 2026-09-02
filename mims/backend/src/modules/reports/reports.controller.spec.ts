import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ROLES_KEY, RolesGuard } from '../auth/guards/roles.guard';

describe('ReportsController — registration report access', () => {
  let controller: ReportsController;
  let reflector: Reflector;

  const mockReportsService = { getRegistrationReport: jest.fn().mockResolvedValue({}) };

  const query = { startDate: '2026-09-01', endDate: '2026-09-01' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockReportsService }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    reflector = new Reflector();
  });

  const requiredRoles = () =>
    reflector.get<string[]>(ROLES_KEY, ReportsController.prototype.getRegistrationReport);

  it('is restricted to the registration manager and admins', () => {
    expect(requiredRoles()).toEqual([
      'MASTER_ADMIN',
      'SUPER_ADMIN',
      'HOSPITAL_ADMIN',
      'REGISTRATION_STAFF_MANAGER',
    ]);
  });

  it('rejects an unlisted role at the endpoint, not just in the menu', () => {
    const guard = new RolesGuard(reflector);
    const context: any = {
      getHandler: () => ReportsController.prototype.getRegistrationReport,
      getClass: () => ReportsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'REGISTRATION_STAFF' } }),
      }),
    };

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('pins the report to the hospital on the token, ignoring an absent query param', async () => {
    await controller.getRegistrationReport(query, {
      user: { hospitalId: 'hospital-1', role: 'REGISTRATION_STAFF_MANAGER' },
    });

    expect(mockReportsService.getRegistrationReport).toHaveBeenCalledWith(
      expect.objectContaining({ hospitalId: 'hospital-1' }),
    );
  });

  it('refuses a query param naming another hospital', async () => {
    await expect(
      controller.getRegistrationReport(
        { ...query, hospitalId: 'hospital-2' },
        { user: { hospitalId: 'hospital-1', role: 'REGISTRATION_STAFF_MANAGER' } },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockReportsService.getRegistrationReport).not.toHaveBeenCalled();
  });

  it('lets a platform admin with no hospital of their own name one', async () => {
    await controller.getRegistrationReport(
      { ...query, hospitalId: 'hospital-2' },
      { user: { hospitalId: null, role: 'SUPER_ADMIN' } },
    );

    expect(mockReportsService.getRegistrationReport).toHaveBeenCalledWith(
      expect.objectContaining({ hospitalId: 'hospital-2' }),
    );
  });

  it('requires a hospital when the token carries none', async () => {
    await expect(
      controller.getRegistrationReport(query, { user: { hospitalId: null, role: 'SUPER_ADMIN' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
