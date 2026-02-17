import { Module } from '@nestjs/common';
import { BiometricEnrollmentsService } from './biometric-enrollments.service';
import { BiometricEnrollmentsController } from './biometric-enrollments.controller';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BiometricEnrollmentsController],
  providers: [BiometricEnrollmentsService],
  exports: [BiometricEnrollmentsService],
})
export class BiometricEnrollmentsModule {}
