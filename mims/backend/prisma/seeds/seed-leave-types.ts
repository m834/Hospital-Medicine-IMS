import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedLeaveTypes() {
  console.log('📋 Seeding leave types...');

  try {
    // Get first hospital
    const hospital = await prisma.hospital.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!hospital) {
      console.log('⚠️  No hospital found. Skipping leave types seeding...');
      return;
    }

    // Check if leave types already exist
    const existingLeaveTypes = await prisma.leaveType.count({
      where: { hospitalId: hospital.id },
    });

    if (existingLeaveTypes > 0) {
      console.log(`⚠️  Leave types already exist for hospital ${hospital.name}. Skipping...\n`);
      return;
    }

    // Define leave types
    const leaveTypesData = [
      {
        name: 'Annual Leave',
        code: 'ANNUAL',
        maxDaysPerYear: 20,
        isPaid: true,
        requiresApproval: true,
        canCarryForward: true,
        maxCarryForward: 5,
        isActive: true,
        description: 'Annual paid leave - up to 20 days per year, 5 days carry forward',
      },
      {
        name: 'Sick Leave',
        code: 'SICK',
        maxDaysPerYear: 10,
        isPaid: true,
        requiresApproval: true,
        canCarryForward: false,
        maxCarryForward: 0,
        isActive: true,
        description: 'Paid sick leave - up to 10 days per year (medical certificate required)',
      },
      {
        name: 'Casual Leave',
        code: 'CASUAL',
        maxDaysPerYear: 8,
        isPaid: true,
        requiresApproval: true,
        canCarryForward: false,
        maxCarryForward: 0,
        isActive: true,
        description: 'Casual leave - up to 8 days per year for personal reasons',
      },
      {
        name: 'Maternity Leave',
        code: 'MATERNITY',
        maxDaysPerYear: 90,
        isPaid: true,
        requiresApproval: true,
        canCarryForward: false,
        maxCarryForward: 0,
        isActive: true,
        description: 'Paid maternity leave - up to 90 days (government approved)',
      },
      {
        name: 'Paternity Leave',
        code: 'PATERNITY',
        maxDaysPerYear: 10,
        isPaid: true,
        requiresApproval: true,
        canCarryForward: false,
        maxCarryForward: 0,
        isActive: true,
        description: 'Paid paternity leave - up to 10 days for new fathers',
      },
      {
        name: 'Special Leave',
        code: 'SPECIAL',
        maxDaysPerYear: 5,
        isPaid: true,
        requiresApproval: true,
        canCarryForward: false,
        maxCarryForward: 0,
        isActive: true,
        description: 'Special leave for emergencies and exceptional circumstances',
      },
      {
        name: 'Unpaid Leave',
        code: 'UNPAID',
        maxDaysPerYear: 30,
        isPaid: false,
        requiresApproval: true,
        canCarryForward: false,
        maxCarryForward: 0,
        isActive: true,
        description: 'Unpaid leave - up to 30 days per year',
      },
      {
        name: 'Compensatory Off',
        code: 'COMP_OFF',
        maxDaysPerYear: 12,
        isPaid: true,
        requiresApproval: false,
        canCarryForward: false,
        maxCarryForward: 0,
        isActive: true,
        description: 'Compensatory off for extra hours worked',
      },
    ];

    // Create leave types
    const createdLeaveTypes = [];
    for (const leaveTypeData of leaveTypesData) {
      const leaveType = await prisma.leaveType.create({
        data: {
          ...leaveTypeData,
          hospitalId: hospital.id,
        },
      });
      createdLeaveTypes.push(leaveType);
      console.log(`   ✅ Created leave type: ${leaveType.name} (${leaveType.code}) - ${leaveType.maxDaysPerYear} days`);
    }

    console.log(`✅ Successfully seeded ${createdLeaveTypes.length} leave types\n`);
    return createdLeaveTypes;
  } catch (error) {
    console.error('❌ Error seeding leave types:', error);
    throw error;
  }
}
