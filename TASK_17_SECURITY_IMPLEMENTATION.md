# Task 17: Security Implementation Guide

**Task:** Task 17 - Security Implementation & Hardening  
**Status:** 🔐 READY TO START  
**Duration:** 2-3 days  
**Priority:** CRITICAL

---

## 🔒 SECURITY OBJECTIVES

1. **Authentication & Authorization**
   - JWT token validation on all endpoints
   - Role-based access control (RBAC) enforcement
   - Session management and token refresh

2. **Input Validation & Sanitization**
   - Validate all user inputs
   - Prevent SQL injection attacks
   - Prevent XSS attacks
   - Prevent CSRF attacks

3. **Rate Limiting & DDoS Protection**
   - Rate limit all public endpoints
   - IP-based blocking
   - Adaptive rate limiting

4. **Data Protection**
   - Encryption at rest (database fields)
   - Encryption in transit (TLS)
   - Secure password hashing
   - Audit logging for sensitive operations

5. **Error Handling**
   - No sensitive information in error responses
   - Consistent error response format
   - Proper HTTP status codes

---

## 🛡️ IMPLEMENTATION CHECKLIST

### Authentication & Authorization

#### 1. JWT Validation Module
```typescript
// jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
```

#### 2. RBAC Guards
```typescript
// roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('No user information');

    const hasRole = () => requiredRoles.some((role) => user.roles?.includes(role));
    if (!hasRole()) {
      throw new ForbiddenException(`Requires role(s): ${requiredRoles.join(', ')}`);
    }
    return true;
  }
}
```

#### 3. Decorator for RBAC
```typescript
// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

#### 4. Usage in Controllers
```typescript
@Controller('/api/v1/shifts')
export class ShiftController {
  @Post()
  @Roles('ADMIN', 'HR_MANAGER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  createShift(@Body() dto: CreateShiftDto) {
    // Only ADMIN or HR_MANAGER can create shifts
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getShifts() {
    // All authenticated users can view shifts
  }

  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  deleteShift(@Param('id') id: string) {
    // Only ADMIN can delete shifts
  }
}
```

### Rate Limiting

#### 1. Install Rate Limit Package
```bash
npm install @nestjs/throttler
npm install throttle-limit-redis
```

#### 2. Configure Rate Limiting
```typescript
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // seconds
      limit: 100, // requests per ttl
      storage: new RedisStorage(),
      skipIf: (req) => req.path === '/health', // Skip health checks
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

#### 3. Custom Rate Limit Decorators
```typescript
// rate-limit.decorator.ts
import { Throttle } from '@nestjs/throttler';

export const PublicRateLimit = () => Throttle(10, 60); // 10 req/min
export const AuthenticatedRateLimit = () => Throttle(100, 60); // 100 req/min
export const AdminRateLimit = () => Throttle(1000, 60); // 1000 req/min
```

### Input Validation & Sanitization

#### 1. ValidationPipe Configuration
```typescript
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // Remove unknown properties
    forbidNonWhitelisted: true, // Throw on unknown properties
    transform: true,            // Auto-transform to DTO type
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

#### 2. Sanitization Decorator
```typescript
// sanitize.decorator.ts
import { Transform } from 'class-transformer';
import * as sanitizeHtml from 'sanitize-html';

export const SanitizeHtml = () => {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    });
  });
};
```

#### 3. Usage in DTOs
```typescript
// create-shift.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';
import { SanitizeHtml } from '../decorators/sanitize.decorator';

export class CreateShiftDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @SanitizeHtml()
  name: string;

  @IsString()
  @MaxLength(500)
  @SanitizeHtml()
  description: string;
}
```

### SQL Injection Prevention

#### 1. Always Use Parameterized Queries
```typescript
// BAD - Never do this
const query = `SELECT * FROM users WHERE id = '${userId}'`;
const result = await connection.query(query);

// GOOD - Use Prisma (parameterized by default)
const user = await prisma.user.findUnique({
  where: { id: userId },
});
```

#### 2. Prisma Raw Query Safety
```typescript
// Safe raw queries with parameters
const users = await prisma.$queryRaw`
  SELECT * FROM users 
  WHERE id = ${userId} 
  AND status = ${status}
`;

// Not this - UNSAFE
const users = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE id = '${userId}'`
);
```

### XSS Prevention

#### 1. Output Encoding
```typescript
// Automatically handled by JSON response serialization
// But for HTML rendering, use sanitization

@Get(':id')
async getAttendance(@Param('id') id: string) {
  const record = await this.attendanceService.findOne(id);
  // Response is automatically JSON encoded
  return record;
}
```

#### 2. Content Security Policy
```typescript
// main.ts
app.use(helmet()); // Sets various security headers

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
    },
  }),
);
```

### CSRF Protection

#### 1. Install CSRF Package
```bash
npm install csurf
```

#### 2. Configure CSRF
```typescript
// main.ts
import * as csrf from 'csurf';
import * as cookieParser from 'cookie-parser';

app.use(cookieParser());
app.use(csrf({ cookie: true }));
```

#### 3. Apply to Endpoints
```typescript
@Controller('/api/v1/shifts')
export class ShiftController {
  @Post()
  @UseGuards(CsrfGuard)
  createShift(
    @Body() dto: CreateShiftDto,
    @Req() req: Request
  ) {
    // CSRF token validated
  }
}
```

### Data Encryption

#### 1. Biometric Data Encryption
```typescript
// encryption.service.ts
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key = crypto.scryptSync(this.configService.get('ENCRYPTION_KEY'), 'salt', 32);

  encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    const [iv, authTag, encrypted] = encryptedData.split(':');
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

#### 2. Use in Models
```typescript
// biometric-enrollment.entity.ts
import { Exclude } from 'class-transformer';

export class BiometricEnrollment {
  id: string;
  employeeId: string;
  
  @Exclude()
  encryptedBiometricTemplate: string; // Stored encrypted
  
  status: string;
  enrollmentDate: Date;
}
```

### Audit Logging

#### 1. Create Audit Log Service
```typescript
// audit.service.ts
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    changes: any,
    ipAddress: string,
  ) {
    return await this.prisma.auditLog.create({
      data: {
        userId,
        action,           // CREATE, UPDATE, DELETE
        entity,           // User, Shift, LeaveRequest, etc.
        entityId,
        changes,          // What changed (JSON)
        ipAddress,
        timestamp: new Date(),
      },
    });
  }

  async getByEntity(entity: string, entityId: string) {
    return await this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { timestamp: 'desc' },
    });
  }
}
```

#### 2. Intercept Changes
```typescript
// audit.interceptor.ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const { user } = req;
    
    return next.handle().pipe(
      tap(async (data) => {
        if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
          await this.auditService.log(
            user.userId,
            req.method,
            context.getClass().name,
            req.params.id || data.id,
            req.body,
            req.ip,
          );
        }
      }),
    );
  }
}
```

### Error Handling

#### 1. Global Exception Filter
```typescript
// global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ExecutionContext) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    let status = 500;
    let message = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }

    // Never expose sensitive details in response
    const responseObject = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: this.sanitizeMessage(message, status),
    };

    // Log full error internally
    console.error(exception);

    response.status(status).json(responseObject);
  }

  private sanitizeMessage(message: string, status: number): string {
    // Don't expose internal details to client
    if (status === 500) return 'Internal Server Error';
    if (status === 401) return 'Unauthorized';
    if (status === 403) return 'Forbidden';
    if (status === 404) return 'Not Found';
    return message;
  }
}
```

#### 2. Register Filter
```typescript
// main.ts
app.useGlobalFilters(new GlobalExceptionFilter());
```

---

## 🧪 SECURITY TESTING

### Test Cases to Implement

#### 1. Authentication Tests
```typescript
describe('Authentication Security', () => {
  it('should reject requests without JWT token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/shifts');
    expect(response.status).toBe(401);
  });

  it('should reject requests with invalid JWT token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/shifts')
      .set('Authorization', 'Bearer invalid-token');
    expect(response.status).toBe(401);
  });

  it('should reject requests with expired JWT token', async () => {
    const expiredToken = generateExpiredToken();
    const response = await request(app.getHttpServer())
      .get('/api/v1/shifts')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(response.status).toBe(401);
  });
});
```

#### 2. Authorization Tests
```typescript
describe('Authorization Security', () => {
  it('should deny access to users without required role', async () => {
    const userToken = generateTokenForRole('USER');
    const response = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${userToken}`)
      .send(createShiftDto);
    expect(response.status).toBe(403);
  });

  it('should allow access to users with required role', async () => {
    const adminToken = generateTokenForRole('ADMIN');
    const response = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createShiftDto);
    expect(response.status).toBe(201);
  });
});
```

#### 3. SQL Injection Tests
```typescript
describe('SQL Injection Prevention', () => {
  it('should prevent SQL injection in employee ID', async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/employees/emp-001' OR '1'='1")
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(404); // Not found, not error
  });

  it('should sanitize input parameters', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/attendance-records')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        employeeId: "'; DROP TABLE employees; --",
        deviceId: 'device-001',
      });
    expect(response.status).toBe(400); // Validation error
  });
});
```

#### 4. XSS Tests
```typescript
describe('XSS Prevention', () => {
  it('should sanitize HTML in string fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: '<script>alert("xss")</script>',
        description: '<img src=x onerror="alert(1)">',
      });
    expect(response.status).toBe(400); // Validation error
  });

  it('should not return unescaped HTML in responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/shifts/shift-001')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.body.name).not.toContain('<script>');
  });
});
```

#### 5. Rate Limiting Tests
```typescript
describe('Rate Limiting', () => {
  it('should rate limit public endpoints', async () => {
    for (let i = 0; i < 101; i++) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/shifts');
      
      if (i < 100) {
        expect([200, 401]).toContain(response.status); // Allow or reject for auth
      } else {
        expect(response.status).toBe(429); // Too many requests
      }
    }
  });

  it('should rate limit authenticated endpoints with higher limit', async () => {
    for (let i = 0; i < 101; i++) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/shifts')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect([200, 429]).toContain(response.status);
    }
  });
});
```

---

## 📋 SECURITY CHECKLIST

### Pre-Deployment
- [ ] All endpoints protected with authentication
- [ ] RBAC rules defined and tested
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints
- [ ] Output encoding verified
- [ ] SQL injection tests passing
- [ ] XSS tests passing
- [ ] CSRF protection enabled
- [ ] Error messages sanitized
- [ ] Sensitive data encrypted
- [ ] Audit logging functional
- [ ] Security headers configured
- [ ] HTTPS/TLS enabled
- [ ] API keys and secrets secured
- [ ] Database credentials secured

### Post-Deployment
- [ ] Monitor security logs
- [ ] Review audit logs daily
- [ ] Test security regularly
- [ ] Update dependencies
- [ ] Patch vulnerabilities
- [ ] Conduct security review

---

## 🚀 IMPLEMENTATION PLAN

### Day 1: Authentication & Authorization
- [ ] Set up JWT strategy
- [ ] Create RBAC guards and decorators
- [ ] Protect all endpoints
- [ ] Test authentication

### Day 2: Input Validation & Rate Limiting
- [ ] Configure validation pipe
- [ ] Create sanitization decorators
- [ ] Set up rate limiting
- [ ] Test rate limiting

### Day 3: Encryption & Audit Logging
- [ ] Implement encryption service
- [ ] Add audit logging
- [ ] Configure error handling
- [ ] Security testing

---

## 📚 REFERENCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Security](https://docs.nestjs.com/security)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax.html)

---

**Status:** 🔐 Ready for implementation  
**Priority:** CRITICAL  
**Target Completion:** Feb 23, 2026
