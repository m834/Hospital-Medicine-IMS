import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedHolidays() {
  console.log('🎄 Seeding holidays...');

  try {
    // Get first hospital
    const hospital = await prisma.hospital.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!hospital) {
      console.log('⚠️  No hospital found. Skipping holidays seeding...');
      return;
    }

    // Get current year
    const currentYear = new Date().getFullYear();

    // Check if holidays already exist for current year
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    const existingHolidays = await prisma.holiday.count({
      where: {
        hospitalId: hospital.id,
        holidayDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
    });

    if (existingHolidays > 0) {
      console.log(`⚠️  Holidays already exist for ${currentYear}. Skipping...\n`);
      return;
    }

    // Define holidays for the year
    const holidaysData = [
      {
        name: 'New Year Day',
        holidayDate: new Date(currentYear, 0, 1),
        holidayType: 'PUBLIC' as const,
        description: 'New Year celebration',
      },
      {
        name: 'Kashmir Day',
        holidayDate: new Date(currentYear, 1, 5),
        holidayType: 'PUBLIC' as const,
        description: 'Kashmir Day',
      },
      {
        name: 'Pakistan Day',
        holidayDate: new Date(currentYear, 2, 23),
        holidayType: 'PUBLIC' as const,
        description: 'Pakistan Independence Movement Day',
      },
      {
        name: 'Labour Day',
        holidayDate: new Date(currentYear, 4, 1),
        holidayType: 'PUBLIC' as const,
        description: 'International Workers Day',
      },
      {
        name: 'Independence Day',
        holidayDate: new Date(currentYear, 7, 14),
        holidayType: 'PUBLIC' as const,
        description: 'Pakistan Independence Day',
      },
      {
        name: 'Iqbal Day',
        holidayDate: new Date(currentYear, 10, 9),
        holidayType: 'PUBLIC' as const,
        description: 'Allama Iqbal Day',
      },
      {
        name: 'Quaid e Azam Birthday',
        holidayDate: new Date(currentYear, 11, 25),
        holidayType: 'PUBLIC' as const,
        description: 'Birthday of Muhammad Ali Jinnah',
      },
      {
        name: 'Eid ul-Fitr',
        holidayDate: new Date(currentYear, 3, 10),
        holidayType: 'PUBLIC' as const,
        description: 'Festival of Breaking the Fast (Date may vary based on lunar calendar)',
      },
      {
        name: 'Eid ul-Adha',
        holidayDate: new Date(currentYear, 5, 16),
        holidayType: 'PUBLIC' as const,
        description: 'Festival of Sacrifice (Date may vary based on lunar calendar)',
      },
      {
        name: 'Ashura (9th Muharram)',
        holidayDate: new Date(currentYear, 6, 15),
        holidayType: 'RESTRICTED' as const,
        description: 'Day of Ashura',
      },
      {
        name: 'Eid Milad-un-Nabi',
        holidayDate: new Date(currentYear, 8, 15),
        holidayType: 'PUBLIC' as const,
        description: 'Birthday of Prophet Muhammad (Date may vary)',
      },
      {
        name: 'Staff Appreciation Day',
        holidayDate: new Date(currentYear, 5, 20),
        holidayType: 'OPTIONAL' as const,
        description: 'Hospital staff appreciation day',
      },
      {
        name: 'Foundation Day',
        holidayDate: new Date(currentYear, 8, 1),
        holidayType: 'OPTIONAL' as const,
        description: 'Hospital foundation and establishment day',
      },
    ];

    // Create holidays
    const createdHolidays = [];
    for (const holidayData of holidaysData) {
      const holiday = await prisma.holiday.create({
        data: {
          ...holidayData,
          hospitalId: hospital.id,
        },
      });
      createdHolidays.push(holiday);
      console.log(
        `   ✅ Created holiday: ${holiday.name} (${holiday.holidayDate.toDateString()}) - ${holiday.holidayType}`
      );
    }

    console.log(`✅ Successfully seeded ${createdHolidays.length} holidays\n`);
    return createdHolidays;
  } catch (error) {
    console.error('❌ Error seeding holidays:', error);
    throw error;
  }
}
