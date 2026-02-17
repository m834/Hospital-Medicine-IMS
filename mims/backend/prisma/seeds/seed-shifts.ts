import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedShifts() {
  console.log('🕐 Seeding shifts...');

  try {
    // Get first hospital (should exist from main seed)
    const hospital = await prisma.hospital.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!hospital) {
      console.log('⚠️  No hospital found. Skipping shift seeding...');
      return;
    }

    // Check if shifts already exist
    const existingShifts = await prisma.shift.count({
      where: { hospitalId: hospital.id },
    });

    if (existingShifts > 0) {
      console.log(`⚠️  Shifts already exist for hospital ${hospital.name}. Skipping...\n`);
      return;
    }

    // Define shift templates
    const shiftsData = [
      {
        name: 'Morning Shift',
        code: 'MORNING',
        startTime: '08:00',
        endTime: '16:00',
        gracePeriodMinutes: 15,
        halfDayThresholdMinutes: 240,
        minWorkingHours: 8.0,
        isNightShift: false,
        breakDurationMinutes: 30,
        isActive: true,
        description: 'Standard morning shift from 8 AM to 4 PM',
      },
      {
        name: 'Afternoon Shift',
        code: 'AFTERNOON',
        startTime: '16:00',
        endTime: '00:00',
        gracePeriodMinutes: 15,
        halfDayThresholdMinutes: 240,
        minWorkingHours: 8.0,
        isNightShift: false,
        breakDurationMinutes: 30,
        isActive: true,
        description: 'Afternoon shift from 4 PM to 12 AM',
      },
      {
        name: 'Night Shift',
        code: 'NIGHT',
        startTime: '00:00',
        endTime: '08:00',
        gracePeriodMinutes: 15,
        halfDayThresholdMinutes: 240,
        minWorkingHours: 8.0,
        isNightShift: true,
        breakDurationMinutes: 30,
        isActive: true,
        description: 'Night shift from 12 AM to 8 AM',
      },
      {
        name: 'Extended Shift',
        code: 'EXTENDED',
        startTime: '06:00',
        endTime: '18:00',
        gracePeriodMinutes: 10,
        halfDayThresholdMinutes: 360,
        minWorkingHours: 10.0,
        isNightShift: false,
        breakDurationMinutes: 45,
        isActive: true,
        description: '12-hour extended shift from 6 AM to 6 PM',
      },
    ];

    // Create shifts
    const createdShifts = [];
    for (const shiftData of shiftsData) {
      const shift = await prisma.shift.create({
        data: {
          ...shiftData,
          hospitalId: hospital.id,
        },
      });
      createdShifts.push(shift);
      console.log(`   ✅ Created shift: ${shift.name} (${shift.code})`);
    }

    console.log(`✅ Successfully seeded ${createdShifts.length} shifts\n`);
    return createdShifts;
  } catch (error) {
    console.error('❌ Error seeding shifts:', error);
    throw error;
  }
}
