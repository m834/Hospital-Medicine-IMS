import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedAttendanceConfig() {
  console.log('⚙️  Seeding attendance configuration...');

  try {
    // Get first hospital
    const hospital = await prisma.hospital.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!hospital) {
      console.log('⚠️  No hospital found. Skipping attendance config seeding...');
      return;
    }

    // Check if config already exists
    const existingConfig = await prisma.attendanceConfig.count({
      where: { hospitalId: hospital.id },
    });

    if (existingConfig > 0) {
      console.log(
        `⚠️  Attendance configuration already exists for hospital ${hospital.name}. Skipping...\n`
      );
      return;
    }

    // Define configuration
    const configData = [
      {
        configKey: 'GRACE_PERIOD_MINUTES',
        configValue: '15',
        dataType: 'number',
        description: 'Grace period in minutes for early attendance marking',
      },
      {
        configKey: 'HALF_DAY_THRESHOLD_MINUTES',
        configValue: '240',
        dataType: 'number',
        description: 'Hours threshold for marking attendance as half day (in minutes)',
      },
      {
        configKey: 'ENABLE_BIOMETRIC_ENROLLMENT',
        configValue: 'true',
        dataType: 'boolean',
        description: 'Enable/disable biometric enrollment for employees',
      },
      {
        configKey: 'ENABLE_DEVICE_SYNC',
        configValue: 'true',
        dataType: 'boolean',
        description: 'Enable/disable automatic device synchronization',
      },
      {
        configKey: 'DEVICE_SYNC_INTERVAL_MINUTES',
        configValue: '5',
        dataType: 'number',
        description: 'Device synchronization interval in minutes',
      },
      {
        configKey: 'DUPLICATE_CHECK_WINDOW_MINUTES',
        configValue: '5',
        dataType: 'number',
        description: 'Time window to consider logs as duplicates (in minutes)',
      },
      {
        configKey: 'ENABLE_MANUAL_ATTENDANCE',
        configValue: 'true',
        dataType: 'boolean',
        description: 'Allow HR to manually mark attendance',
      },
      {
        configKey: 'REQUIRE_CORRECTION_REASON',
        configValue: 'true',
        dataType: 'boolean',
        description: 'Require reason when correcting attendance',
      },
      {
        configKey: 'LEAVE_APPROVAL_REQUIRED',
        configValue: 'true',
        dataType: 'boolean',
        description: 'Require approval for leave applications',
      },
      {
        configKey: 'ENABLE_LEAVE_BALANCE_CARRY_FORWARD',
        configValue: 'true',
        dataType: 'boolean',
        description: 'Enable carry forward of unused leave balance',
      },
      {
        configKey: 'ENABLE_REAL_TIME_DASHBOARD',
        configValue: 'true',
        dataType: 'boolean',
        description: 'Enable real-time attendance dashboard updates',
      },
      {
        configKey: 'WORKING_DAYS_PER_WEEK',
        configValue: '5',
        dataType: 'number',
        description: 'Number of working days per week',
      },
      {
        configKey: 'WEEKLY_OFF_DAYS',
        configValue: '["SATURDAY", "SUNDAY"]',
        dataType: 'json',
        description: 'Days of the week marked as off (JSON array)',
      },
      {
        configKey: 'OVERTIME_MULTIPLIER',
        configValue: '1.5',
        dataType: 'number',
        description: 'Multiplier for overtime hours calculation',
      },
      {
        configKey: 'DEVICE_CONNECTION_TIMEOUT_SECONDS',
        configValue: '30',
        dataType: 'number',
        description: 'Device connection timeout in seconds',
      },
      {
        configKey: 'BIOMETRIC_TEMPLATE_ENCRYPTION_ENABLED',
        configValue: 'true',
        dataType: 'boolean',
        description: 'Enable AES-256 encryption for biometric templates',
      },
      {
        configKey: 'MAX_ENROLLMENT_ATTEMPTS',
        configValue: '5',
        dataType: 'number',
        description: 'Maximum enrollment attempts before rejection',
      },
      {
        configKey: 'ENROLLMENT_QUALITY_THRESHOLD',
        configValue: '75',
        dataType: 'number',
        description: 'Minimum quality score for biometric enrollment (0-100)',
      },
    ];

    // Create configuration
    const createdConfigs = [];
    for (const config of configData) {
      const attendanceConfig = await prisma.attendanceConfig.create({
        data: {
          ...config,
          hospitalId: hospital.id,
        },
      });
      createdConfigs.push(attendanceConfig);
      console.log(`   ✅ Created config: ${attendanceConfig.configKey} = ${attendanceConfig.configValue}`);
    }

    console.log(`✅ Successfully seeded ${createdConfigs.length} configuration items\n`);
    return createdConfigs;
  } catch (error) {
    console.error('❌ Error seeding attendance configuration:', error);
    throw error;
  }
}
