/**
 * Copyright (c) 2026 Code Hustlers. All rights reserved.
 * M-IMS — Hospital Medicine Inventory Management System
 * Unauthorized use or distribution is strictly prohibited.
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { enforeceLicenseOrExit } from './common/license/license-validator';

async function bootstrap() {
  // ─────────────────────────────────────────────────────────
  // LICENSE VALIDATION — must pass before anything initializes
  // ─────────────────────────────────────────────────────────
  await enforeceLicenseOrExit();

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // SECURITY: Global Exception Filter
  // Prevents sensitive information leakage in error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Security
  app.use(helmet());

  // PERFORMANCE OPTIMIZATION: Enable gzip compression
  // Reduces response size by 60-80% for JSON/text
  app.use(compression({
    threshold: 1024, // Only compress responses larger than 1KB
    level: 6, // Compression level (0-9, 6 is good balance)
  }));
  
  // CORS configuration
  app.enableCors({
    origin: configService.get('FRONTEND_URL') || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API versioning
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Hospital Medicine IMS - Attendance Module API')
    .setDescription('Comprehensive REST API for Hospital Attendance Management System with biometric device integration, employee enrollment, shift management, and leave tracking')
    .setVersion('1.0.0')
    .setContact('Hospital IT Support', '', 'support@hospital.local')
    .setLicense('Proprietary', '')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
      'access-token',
    )
    // Biometric Devices
    .addTag('Biometric Devices', 'Device registration, management, and monitoring')
    .addTag('Device Status', 'Real-time device status and connectivity monitoring')
    // Biometric Enrollments
    .addTag('Biometric Enrollments', 'Employee biometric enrollment and template management')
    .addTag('Enrollment Templates', 'Fingerprint, face, and iris template storage')
    // Attendance Records
    .addTag('Attendance Records', 'Mark attendance, corrections, and history')
    .addTag('Attendance Reports', 'Attendance analytics and reporting')
    // Shifts
    .addTag('Shift Management', 'Shift creation, assignment, and roster management')
    .addTag('Shift Templates', 'Reusable shift patterns and rotations')
    // Leaves
    .addTag('Leave Management', 'Leave applications, approvals, and balance tracking')
    .addTag('Leave Types', 'Leave type definitions and policies')
    // Device Sync
    .addTag('Device Synchronization', 'Real-time device sync and batch operations')
    .addTag('Sync Logs', 'Device synchronization logs and statistics')
    // System
    .addTag('System Configuration', 'Attendance configuration and system settings')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = configService.get('PORT') || 3001;
  await app.listen(port);
  
  console.log(`🚀 M-IMS Backend API running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
