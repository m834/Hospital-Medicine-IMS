# 🚀 NEXT 2 WEEKS - HIGH PRIORITY ACTION ITEMS

**Last Updated:** January 6, 2026  
**Goal:** Fix critical issues and add essential foundation features

---

## 🔥 WEEK 1: TOKEN VALIDATION FIX (CRITICAL)

### Problem
Your IMPLEMENTATION_PLAN.md identified a critical issue:
> "Dashboard opens with expired token → shows zero data"

This MUST be fixed before production!

### Solution Checklist

#### Day 1-2: Auth Utilities Enhancement
- [ ] **Create/Update `frontend/src/lib/auth.ts`**
  ```typescript
  export async function validateToken(): Promise<boolean> {
    // Step 1: Token exists?
    const token = localStorage.getItem('mims_access_token');
    if (!token) return false;
    
    // Step 2: Token expired? (client-side)
    const expiry = parseInt(localStorage.getItem('mims_token_expiry') || '0');
    if (Date.now() >= expiry * 1000) return false;
    
    // Step 3: Token valid? (server-side)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  export function clearAuthTokens() {
    localStorage.removeItem('mims_access_token');
    localStorage.removeItem('mims_refresh_token');
    localStorage.removeItem('mims_token_expiry');
    localStorage.removeItem('mims_user_data');
  }
  
  export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    if (!response.ok) throw new Error('Refresh failed');
    return response.json();
  }
  ```

#### Day 3-4: Axios Interceptor Enhancement
- [ ] **Update `frontend/src/lib/api.ts`**
  ```typescript
  import axios from 'axios';
  import { refreshAccessToken, clearAuthTokens } from './auth';
  
  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    timeout: 30000,
  });
  
  // Request interceptor - add token
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('mims_access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
  
  // Response interceptor - handle 401
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        
        // Try refresh token
        const refreshToken = localStorage.getItem('mims_refresh_token');
        if (refreshToken) {
          try {
            const { accessToken } = await refreshAccessToken(refreshToken);
            localStorage.setItem('mims_access_token', accessToken);
            
            // Update auth header and retry request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            // Refresh failed - logout
            clearAuthTokens();
            window.location.href = '/login?error=session_expired';
            return Promise.reject(refreshError);
          }
        } else {
          // No refresh token - logout
          clearAuthTokens();
          window.location.href = '/login?error=session_expired';
        }
      }
      
      return Promise.reject(error);
    }
  );
  
  export default api;
  ```

#### Day 5: Middleware Update
- [ ] **Update `frontend/src/middleware.ts`**
  ```typescript
  import { NextResponse } from 'next/server';
  import type { NextRequest } from 'next/server';
  
  export function middleware(request: NextRequest) {
    const token = request.cookies.get('mims_access_token')?.value;
    const isAuthPage = request.nextUrl.pathname.startsWith('/login');
    const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
    
    // Redirect to login if accessing dashboard without token
    if (isDashboard && !token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Redirect to dashboard if accessing login with valid token
    if (isAuthPage && token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    return NextResponse.next();
  }
  
  export const config = {
    matcher: ['/dashboard/:path*', '/login'],
  };
  ```

#### Day 6: Dashboard Layout Enhancement
- [ ] **Update `frontend/src/app/(dashboard)/layout.tsx`**
  ```typescript
  'use client';
  
  import { useEffect, useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { validateToken } from '@/lib/auth';
  
  export default function DashboardLayout({ children }) {
    const [isValidating, setIsValidating] = useState(true);
    const router = useRouter();
    
    useEffect(() => {
      const checkAuth = async () => {
        const isValid = await validateToken();
        if (!isValid) {
          router.replace('/login?error=session_expired');
        } else {
          setIsValidating(false);
        }
      };
      
      checkAuth();
      
      // Re-validate every 5 minutes
      const interval = setInterval(checkAuth, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }, [router]);
    
    if (isValidating) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">Validating session...</p>
          </div>
        </div>
      );
    }
    
    return <>{children}</>;
  }
  ```

#### Day 7: Testing
- [ ] Test login flow
- [ ] Test token expiry (set expiry to 1 minute for testing)
- [ ] Test refresh token flow
- [ ] Test auto-logout on 401
- [ ] Test dashboard access without token
- [ ] Test session timeout warning
- [ ] Verify no data shows with expired token

### Deliverables
- ✅ Token validation working perfectly
- ✅ Auto-refresh on token expiry
- ✅ Auto-logout on refresh failure
- ✅ No dashboard data leakage with expired tokens
- ✅ Smooth user experience

---

## ⚡ WEEK 2: FEATURE FLAGS SYSTEM

### Problem
New HMS requirements need module toggling per hospital (OPD, IPD, Lab, Radiology, etc.)

### Solution Checklist

#### Day 1: Database Schema
- [ ] **Update `mims/backend/prisma/schema.prisma`**
  ```prisma
  // Add after Hospital model
  model FeatureFlag {
    id          String     @id @default(uuid())
    hospitalId  String     @map("hospital_id")
    moduleName  ModuleType @map("module_name")
    isEnabled   Boolean    @default(true) @map("is_enabled")
    config      Json?      // Optional module-specific config
    createdAt   DateTime   @default(now()) @map("created_at")
    updatedAt   DateTime   @updatedAt @map("updated_at")
    
    hospital    Hospital   @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
    
    @@unique([hospitalId, moduleName])
    @@index([hospitalId])
    @@index([moduleName])
    @@map("feature_flags")
  }
  
  // Add to end of file
  enum ModuleType {
    OPD
    IPD
    PHARMACY
    INVENTORY
    LAB
    RADIOLOGY
    REPORTS
    DEPARTMENTS
    BILLING
    STAFF_ROASTER
  }
  ```

- [ ] **Update Hospital model to add relation**
  ```prisma
  model Hospital {
    // ... existing fields ...
    featureFlags       FeatureFlag[]  // Add this line
  }
  ```

- [ ] **Run migration**
  ```bash
  cd mims/backend
  npx prisma migrate dev --name add_feature_flags
  npx prisma generate
  ```

#### Day 2: Backend Module
- [ ] **Create `mims/backend/src/modules/feature-flags/` directory**

- [ ] **Create `feature-flags.module.ts`**
  ```typescript
  import { Module } from '@nestjs/common';
  import { FeatureFlagsController } from './feature-flags.controller';
  import { FeatureFlagsService } from './feature-flags.service';
  
  @Module({
    controllers: [FeatureFlagsController],
    providers: [FeatureFlagsService],
    exports: [FeatureFlagsService],
  })
  export class FeatureFlagsModule {}
  ```

- [ ] **Create `feature-flags.service.ts`**
  ```typescript
  import { Injectable, NotFoundException } from '@nestjs/common';
  import { PrismaService } from '../../database/prisma.service';
  import { CacheService } from '../../common/services/cache.service';
  
  @Injectable()
  export class FeatureFlagsService {
    private readonly CACHE_TTL = 300; // 5 minutes
    
    constructor(
      private prisma: PrismaService,
      private cache: CacheService,
    ) {}
    
    async isModuleEnabled(hospitalId: string, moduleName: string): Promise<boolean> {
      const cacheKey = `feature:${hospitalId}:${moduleName}`;
      
      // Check cache first
      const cached = await this.cache.get<boolean>(cacheKey);
      if (cached !== null) return cached;
      
      // Query database
      const flag = await this.prisma.featureFlag.findUnique({
        where: {
          hospitalId_moduleName: { hospitalId, moduleName },
        },
      });
      
      const isEnabled = flag?.isEnabled ?? true; // Default to enabled
      
      // Cache result
      await this.cache.set(cacheKey, isEnabled, this.CACHE_TTL);
      
      return isEnabled;
    }
    
    async getAllFeatures(hospitalId: string) {
      return this.prisma.featureFlag.findMany({
        where: { hospitalId },
      });
    }
    
    async toggleFeature(hospitalId: string, moduleName: string, isEnabled: boolean) {
      const flag = await this.prisma.featureFlag.upsert({
        where: {
          hospitalId_moduleName: { hospitalId, moduleName },
        },
        update: { isEnabled },
        create: {
          hospitalId,
          moduleName,
          isEnabled,
        },
      });
      
      // Invalidate cache
      await this.cache.del(`feature:${hospitalId}:${moduleName}`);
      
      return flag;
    }
  }
  ```

- [ ] **Create `feature-flags.controller.ts`**
  ```typescript
  import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../auth/guards/roles.guard';
  import { Roles } from '../auth/decorators/roles.decorator';
  import { CurrentHospital } from '../auth/decorators/current-hospital.decorator';
  import { FeatureFlagsService } from './feature-flags.service';
  import { ToggleFeatureFlagDto } from './dto/toggle-feature-flag.dto';
  
  @ApiTags('Feature Flags')
  @ApiBearerAuth()
  @Controller('feature-flags')
  @UseGuards(JwtAuthGuard, RolesGuard)
  export class FeatureFlagsController {
    constructor(private readonly service: FeatureFlagsService) {}
    
    @Get()
    @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN')
    @ApiOperation({ summary: 'Get all feature flags for hospital' })
    async getAllFeatures(@CurrentHospital() hospitalId: string) {
      return this.service.getAllFeatures(hospitalId);
    }
    
    @Put(':moduleName')
    @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN')
    @ApiOperation({ summary: 'Toggle feature flag' })
    async toggleFeature(
      @CurrentHospital() hospitalId: string,
      @Param('moduleName') moduleName: string,
      @Body() dto: ToggleFeatureFlagDto,
    ) {
      return this.service.toggleFeature(hospitalId, moduleName, dto.isEnabled);
    }
  }
  ```

- [ ] **Create `dto/toggle-feature-flag.dto.ts`**
  ```typescript
  import { IsBoolean } from 'class-validator';
  import { ApiProperty } from '@nestjs/swagger';
  
  export class ToggleFeatureFlagDto {
    @ApiProperty({ example: true })
    @IsBoolean()
    isEnabled: boolean;
  }
  ```

#### Day 3: Feature Flag Guard
- [ ] **Create `mims/backend/src/common/guards/feature-flag.guard.ts`**
  ```typescript
  import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { FeatureFlagsService } from '../../modules/feature-flags/feature-flags.service';
  
  @Injectable()
  export class FeatureFlagGuard implements CanActivate {
    constructor(
      private reflector: Reflector,
      private featureFlagsService: FeatureFlagsService,
    ) {}
    
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const requiredModule = this.reflector.get<string>('feature', context.getHandler());
      
      if (!requiredModule) {
        return true; // No feature flag requirement
      }
      
      const request = context.switchToHttp().getRequest();
      const hospitalId = request.user?.hospitalId;
      
      if (!hospitalId) {
        throw new ForbiddenException('Hospital context required');
      }
      
      const isEnabled = await this.featureFlagsService.isModuleEnabled(hospitalId, requiredModule);
      
      if (!isEnabled) {
        throw new ForbiddenException(`Module ${requiredModule} is not enabled for this hospital`);
      }
      
      return true;
    }
  }
  ```

- [ ] **Create `mims/backend/src/common/decorators/require-feature.decorator.ts`**
  ```typescript
  import { SetMetadata } from '@nestjs/common';
  
  export const RequireFeature = (moduleName: string) => SetMetadata('feature', moduleName);
  ```

#### Day 4: Integration
- [ ] **Update `mims/backend/src/app.module.ts`**
  ```typescript
  import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
  
  @Module({
    imports: [
      // ... existing imports ...
      FeatureFlagsModule,  // Add this
    ],
  })
  export class AppModule {}
  ```

- [ ] **Apply to future modules (example)**
  ```typescript
  @Controller('lab-tests')
  @UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
  @RequireFeature('LAB')  // This controller requires LAB module
  export class LabTestsController {
    // ...
  }
  ```

#### Day 5-6: Frontend UI
- [ ] **Create `frontend/src/app/(dashboard)/settings/features/page.tsx`**
  ```typescript
  'use client';
  
  import { useState, useEffect } from 'use';
  import api from '@/lib/api';
  import { Switch } from '@/components/ui/switch';
  import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
  
  const MODULES = [
    { key: 'OPD', label: 'Outpatient Department (OPD)', description: 'Manage OPD consultations' },
    { key: 'IPD', label: 'Inpatient Department (IPD)', description: 'Manage patient admissions' },
    { key: 'PHARMACY', label: 'Pharmacy', description: 'Medicine inventory and dispensing' },
    { key: 'LAB', label: 'Laboratory', description: 'Lab tests and results' },
    { key: 'RADIOLOGY', label: 'Radiology', description: 'Imaging and radiology' },
    { key: 'BILLING', label: 'Billing', description: 'Consolidated billing system' },
    { key: 'REPORTS', label: 'Reports', description: 'Analytics and reports' },
  ];
  
  export default function FeaturesPage() {
    const [features, setFeatures] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      loadFeatures();
    }, []);
    
    const loadFeatures = async () => {
      try {
        const response = await api.get('/feature-flags');
        const flags = response.data.reduce((acc, flag) => {
          acc[flag.moduleName] = flag.isEnabled;
          return acc;
        }, {});
        setFeatures(flags);
      } catch (error) {
        console.error('Failed to load features:', error);
      } finally {
        setLoading(false);
      }
    };
    
    const toggleFeature = async (moduleName: string) => {
      try {
        const newValue = !features[moduleName];
        await api.put(`/feature-flags/${moduleName}`, { isEnabled: newValue });
        setFeatures(prev => ({ ...prev, [moduleName]: newValue }));
      } catch (error) {
        console.error('Failed to toggle feature:', error);
      }
    };
    
    if (loading) return <div>Loading...</div>;
    
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Module Features</h1>
        <div className="grid gap-4">
          {MODULES.map(module => (
            <Card key={module.key}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h3 className="font-semibold">{module.label}</h3>
                  <p className="text-sm text-gray-600">{module.description}</p>
                </div>
                <Switch
                  checked={features[module.key] ?? true}
                  onCheckedChange={() => toggleFeature(module.key)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  ```

#### Day 7: Testing
- [ ] Test feature flag CRUD operations
- [ ] Test feature flag guard (block access to disabled module)
- [ ] Test cache invalidation
- [ ] Test admin UI for toggling features
- [ ] Document feature flag usage for developers

### Deliverables
- ✅ Feature flags table created
- ✅ Feature flag service working
- ✅ Feature flag guard implemented
- ✅ Admin UI for managing features
- ✅ Caching optimized
- ✅ Documentation updated

---

## ✅ SUCCESS CRITERIA

After 2 weeks, you should have:

1. **Zero dashboard issues** with expired tokens
2. **Smooth auto-refresh** experience
3. **Feature flags system** ready for new modules
4. **Admin UI** to enable/disable modules per hospital
5. **Foundation ready** for clinical module development

---

## 📝 TESTING CHECKLIST

### Token Validation Tests
- [ ] Login with valid credentials
- [ ] Stay on dashboard for 31+ minutes (token expires at 30min)
- [ ] Verify auto-refresh happens without logout
- [ ] Close browser and reopen (refresh token should work)
- [ ] Wait 8 days (refresh token expires)
- [ ] Verify forced logout happens
- [ ] Try accessing dashboard without token
- [ ] Verify redirect to login page

### Feature Flags Tests
- [ ] Enable/disable modules from admin UI
- [ ] Verify disabled module is not accessible
- [ ] Verify enabled module is accessible
- [ ] Check Redis cache is used
- [ ] Verify cache invalidates on toggle
- [ ] Test with multiple hospitals (isolation)

---

## 🎯 AFTER WEEK 2

With these two items complete, you'll have:
- ✅ Production-ready authentication
- ✅ Flexible module system
- ✅ Strong foundation for Phase 2

**Next Steps**: Start building Clinical Module (Departments, Consultations, Orders)

---

**Keep this file updated with your progress! Check off items as you complete them.** ✅
