import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLabTestDto } from './dto/create-lab-test.dto';
import { UpdateLabTestDto } from './dto/update-lab-test.dto';
import { LabTestStatus } from '@prisma/client';

@Injectable()
export class LabTestsService {
  constructor(private prisma: PrismaService) {}

  async create(createLabTestDto: CreateLabTestDto) {
    // Check for duplicate test code
    const existing = await this.prisma.labTest.findUnique({
      where: {
        hospitalId_testCode: {
          hospitalId: createLabTestDto.hospitalId,
          testCode: createLabTestDto.testCode,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Test code ${createLabTestDto.testCode} already exists in this hospital`,
      );
    }

    return this.prisma.labTest.create({
      data: createLabTestDto,
      include: {
        hospital: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(hospitalId: string, filters?: {
    departmentId?: string;
    subDepartmentId?: string;
    testCategory?: string;
    status?: LabTestStatus;
  }) {
    return this.prisma.labTest.findMany({
      where: {
        hospitalId,
        ...(filters?.departmentId && { departmentId: filters.departmentId }),
        ...(filters?.subDepartmentId && { subDepartmentId: filters.subDepartmentId }),
        ...(filters?.testCategory && { testCategory: filters.testCategory }),
        ...(filters?.status && { status: filters.status }),
      },
      include: {
        hospital: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
        _count: { select: { labOrders: true } },
      },
      orderBy: [
        { testCategory: 'asc' },
        { testName: 'asc' },
      ],
    });
  }

  async findOne(id: string) {
    const labTest = await this.prisma.labTest.findUnique({
      where: { id },
      include: {
        hospital: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
        _count: { select: { labOrders: true } },
      },
    });

    if (!labTest) {
      throw new NotFoundException(`Lab test with ID ${id} not found`);
    }

    return labTest;
  }

  async findByDepartment(departmentId: string) {
    return this.prisma.labTest.findMany({
      where: {
        departmentId,
        status: LabTestStatus.ACTIVE,
      },
      include: {
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
      },
      orderBy: { testName: 'asc' },
    });
  }

  async findByCategory(hospitalId: string, category: string) {
    return this.prisma.labTest.findMany({
      where: {
        hospitalId,
        testCategory: category,
        status: LabTestStatus.ACTIVE,
      },
      include: {
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
      },
      orderBy: { testName: 'asc' },
    });
  }

  async getCategories(hospitalId: string) {
    const categories = await this.prisma.labTest.groupBy({
      by: ['testCategory'],
      where: {
        hospitalId,
        status: LabTestStatus.ACTIVE,
      },
      _count: { testCategory: true },
    });

    return categories.map(cat => ({
      category: cat.testCategory,
      count: cat._count.testCategory,
    }));
  }

  async update(id: string, updateLabTestDto: UpdateLabTestDto) {
    // Check if test exists
    await this.findOne(id);

    // If updating test code, check for conflicts
    if (updateLabTestDto.testCode && updateLabTestDto.hospitalId) {
      const existing = await this.prisma.labTest.findFirst({
        where: {
          hospitalId: updateLabTestDto.hospitalId,
          testCode: updateLabTestDto.testCode,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Test code ${updateLabTestDto.testCode} already exists in this hospital`,
        );
      }
    }

    return this.prisma.labTest.update({
      where: { id },
      data: {
        ...updateLabTestDto,
        version: { increment: 1 },
      },
      include: {
        hospital: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    // Check if test exists
    await this.findOne(id);

    // Check if test has orders
    const ordersCount = await this.prisma.labOrder.count({
      where: { labTestId: id },
    });

    if (ordersCount > 0) {
      throw new ConflictException(
        `Cannot delete test with ${ordersCount} existing orders. Set status to DISCONTINUED instead.`,
      );
    }

    return this.prisma.labTest.delete({
      where: { id },
    });
  }

  async updateStatus(id: string, status: LabTestStatus) {
    await this.findOne(id);

    return this.prisma.labTest.update({
      where: { id },
      data: { 
        status,
        version: { increment: 1 },
      },
    });
  }
}
