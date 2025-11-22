import { Module } from '@nestjs/common';
import { PharmaciesService } from './pharmacies.service';
import { PharmaciesController } from './pharmacies.controller';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [PharmaciesController],
  providers: [PharmaciesService, PrismaService],
  exports: [PharmaciesService],
})
export class PharmaciesModule {}
