# Task 16: Database Optimization Strategy

**Task:** Task 16 - Performance Testing & Optimization  
**Focus:** Database indexing and query optimization  
**Status:** 🚀 IN PROGRESS

---

## 📊 DATABASE OPTIMIZATION OBJECTIVES

1. **Query Performance**
   - Attendance queries: <50ms for single employee
   - Device sync queries: <100ms for 5000 records
   - Leave queries: <100ms with filtering
   - Shift queries: <200ms with roster generation

2. **Throughput Targets**
   - Attendance: 10,000+ records/second
   - Device sync: 5,000+ records/second
   - Concurrent connections: 500+

3. **Resource Efficiency**
   - Memory: <500MB heap increase under load
   - CPU: <80% utilization
   - Disk I/O: <100 IOPS average

---

## 🔧 INDEX OPTIMIZATION STRATEGY

### Attendance Records Table Indexes

```prisma
model AttendanceRecord {
  id                String      @id @default(cuid())
  employeeId        String
  deviceId          String
  timestamp         DateTime
  checkInTime       DateTime?
  checkOutTime      DateTime?
  status            String      // PRESENT, ABSENT, LEAVE, etc.
  type              String      // CHECK_IN, CHECK_OUT
  
  // Existing fields...
  
  // INDEXES FOR PERFORMANCE:
  // Index 1: Employee lookup (most common query)
  @@index([employeeId, timestamp])
  
  // Index 2: Time range queries (for reports)
  @@index([timestamp, status])
  
  // Index 3: Device sync lookups
  @@index([deviceId, timestamp])
  
  // Index 4: Daily summary calculations
  @@index([employeeId, timestamp, status])
  
  // Index 5: Department filtering (via employee)
  @@index([employeeId])
  
  // Unique constraint
  @@unique([employeeId, timestamp, type])
}
```

### BiometricEnrollment Table Indexes

```prisma
model BiometricEnrollment {
  id                String      @id @default(cuid())
  employeeId        String
  deviceId          String
  status            String      // PENDING, VERIFIED, REVOKED
  enrollmentDate    DateTime
  
  // INDEXES:
  // Index 1: Employee enrollments lookup
  @@index([employeeId])
  
  // Index 2: Device enrollments
  @@index([deviceId])
  
  // Index 3: Status filtering
  @@index([status, employeeId])
  
  // Index 4: Recent enrollments
  @@index([enrollmentDate])
}
```

### Leave Request Table Indexes

```prisma
model LeaveRequest {
  id                String      @id @default(cuid())
  employeeId        String
  leaveTypeId       String
  status            String      // PENDING, APPROVED, REJECTED
  fromDate          DateTime
  toDate            DateTime
  approverEmployeeId String?
  approvalDate      DateTime?
  
  // INDEXES:
  // Index 1: Employee leave requests
  @@index([employeeId, status])
  
  // Index 2: Approver queue
  @@index([approverEmployeeId, status])
  
  // Index 3: Date range queries (overlaps)
  @@index([fromDate, toDate])
  
  // Index 4: Approval workflow
  @@index([status, approvalDate])
  
  // Index 5: Leave type filtering
  @@index([leaveTypeId, fromDate])
}
```

### ShiftAssignment Table Indexes

```prisma
model ShiftAssignment {
  id                String      @id @default(cuid())
  employeeId        String
  shiftId           String
  startDate         DateTime
  endDate           DateTime
  
  // INDEXES:
  // Index 1: Employee shifts
  @@index([employeeId, startDate])
  
  // Index 2: Shift roster
  @@index([shiftId, startDate])
  
  // Index 3: Date range (conflict detection)
  @@index([startDate, endDate])
  
  // Index 4: Current assignments
  @@index([employeeId, endDate])
}
```

### DeviceSyncLog Table Indexes

```prisma
model DeviceSyncLog {
  id                String      @id @default(cuid())
  deviceId          String
  syncStartTime     DateTime
  syncEndTime       DateTime
  recordsProcessed  Int
  status            String      // SUCCESS, PARTIAL, FAILED
  
  // INDEXES:
  // Index 1: Device sync history
  @@index([deviceId, syncStartTime])
  
  // Index 2: Status tracking
  @@index([status, syncEndTime])
  
  // Index 3: Recent syncs
  @@index([syncEndTime])
}
```

---

## ⚡ QUERY OPTIMIZATION PATTERNS

### Pattern 1: Batch Fetching (N+1 Prevention)

**BAD:**
```typescript
// N+1 Query Problem: 1 + N queries
const employees = await prisma.employee.findMany();
for (const emp of employees) {
  const attendance = await prisma.attendanceRecord.findMany({
    where: { employeeId: emp.id }
  });
}
```

**GOOD:**
```typescript
// Single query with join
const attendance = await prisma.attendanceRecord.findMany({
  where: { employeeId: { in: employeeIds } },
  select: { employeeId: true, timestamp: true, status: true }
});
```

### Pattern 2: Selective Projection

**BAD:**
```typescript
// Fetches all 50 columns
const records = await prisma.attendanceRecord.findMany({
  take: 100
});
```

**GOOD:**
```typescript
// Fetch only needed columns (10x faster for large tables)
const records = await prisma.attendanceRecord.findMany({
  select: {
    id: true,
    employeeId: true,
    timestamp: true,
    status: true
  },
  take: 100
});
```

### Pattern 3: Database-Side Aggregation

**BAD:**
```typescript
// Application-level aggregation
const records = await prisma.attendanceRecord.findMany({
  where: { employeeId: 'emp-001' }
});
const presentCount = records.filter(r => r.status === 'PRESENT').length;
```

**GOOD:**
```typescript
// Database-side aggregation
const result = await prisma.attendanceRecord.aggregate({
  where: { employeeId: 'emp-001', status: 'PRESENT' },
  _count: true
});
const presentCount = result._count;
```

### Pattern 4: Cursor Pagination

**BAD:**
```typescript
// OFFSET is slow on large tables
const records = await prisma.attendanceRecord.findMany({
  skip: 1000,
  take: 20
});
```

**GOOD:**
```typescript
// Cursor pagination is O(1)
const records = await prisma.attendanceRecord.findMany({
  take: 20,
  cursor: { id: lastId },
  orderBy: { id: 'asc' }
});
```

---

## 📈 PERFORMANCE OPTIMIZATION CHECKLIST

### Index Optimization
- [ ] Analyze slow query logs
- [ ] Add composite indexes for multi-column filters
- [ ] Add covering indexes for read-heavy queries
- [ ] Monitor index usage with EXPLAIN ANALYZE
- [ ] Remove unused indexes to improve write performance

### Query Optimization
- [ ] Implement selective column selection (select projection)
- [ ] Replace N+1 queries with batch loading
- [ ] Move aggregations to database
- [ ] Use cursor pagination instead of offset
- [ ] Add query result caching for static data

### Connection Pooling
- [ ] Configure Prisma connection pooling
- [ ] Set appropriate pool size (20-30 connections)
- [ ] Monitor connection utilization
- [ ] Configure timeout and idle timeout

### Caching Strategy
- [ ] Cache frequently accessed data (employees, shifts)
- [ ] Use Redis for session/rate limit data
- [ ] Implement cache invalidation on updates
- [ ] Cache aggregated reports

### Table Maintenance
- [ ] Regular VACUUM and ANALYZE
- [ ] Monitor table bloat
- [ ] Partition large tables (if >1GB)
- [ ] Archive old data

---

## 🔍 MONITORING & PROFILING

### Query Monitoring

```sql
-- Enable query logging
SET log_min_duration_statement = 1000; -- Log queries > 1 second

-- View slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### Index Effectiveness

```sql
-- Unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Expensive indexes (high maintenance cost)
SELECT schemaname, tablename, indexname, idx_blks_read
FROM pg_stat_user_indexes
ORDER BY idx_blks_read DESC;
```

### Connection Monitoring

```sql
-- Active connections
SELECT datname, count(*) as connections
FROM pg_stat_activity
GROUP BY datname;

-- Long-running queries
SELECT pid, duration, query
FROM pg_stat_activity
WHERE state = 'active'
AND duration > interval '1 minute';
```

---

## 📊 EXPECTED PERFORMANCE IMPROVEMENTS

### Before Optimization
- Attendance query: 500ms for 1000 records
- Device sync: 2000ms for 5000 records
- Leave query: 800ms with filtering
- Shift roster: 5000ms for 500 employees

### After Optimization
- Attendance query: 50ms (10x faster)
- Device sync: 200ms (10x faster)
- Leave query: 80ms (10x faster)
- Shift roster: 500ms (10x faster)

### Throughput Improvements
- Single-threaded: 500 → 5000 ops/sec (10x)
- Multi-threaded (16 cores): 8000 → 80,000 ops/sec (10x)

---

## 🛠️ IMPLEMENTATION STEPS

### Step 1: Current State Baseline
```bash
# Profile current queries
npm run test:performance

# Capture baseline metrics
npm run metrics:capture -- --baseline
```

### Step 2: Add Indexes
```bash
# Update schema.prisma with recommended indexes
# Run migration
npm run prisma:migrate -- --name add_performance_indexes

# Verify indexes created
npm run db:analyze
```

### Step 3: Query Optimization
- Update service methods to use selective projection
- Replace N+1 queries with batch operations
- Implement cursor pagination
- Add database-side aggregations

### Step 4: Validation
```bash
# Run performance tests
npm run test:performance

# Compare metrics
npm run metrics:compare
```

### Step 5: Production Deployment
```bash
# Backup database
npm run db:backup

# Apply migrations
npm run prisma:migrate:deploy

# Monitor performance
npm run metrics:monitor
```

---

## 📝 MIGRATION TEMPLATE

```prisma
// schema.prisma

model AttendanceRecord {
  id                String      @id @default(cuid())
  employeeId        String
  deviceId          String
  timestamp         DateTime
  checkInTime       DateTime?
  checkOutTime      DateTime?
  status            String
  type              String
  confidence        Float
  temperature       Float?
  notes             String?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  employee          Employee    @relation(fields: [employeeId], references: [id])
  device            BiometricDevice @relation(fields: [deviceId], references: [id])
  
  // PERFORMANCE INDEXES
  @@index([employeeId, timestamp])          // Employee lookup
  @@index([timestamp, status])              // Time range queries
  @@index([deviceId, timestamp])            // Device sync lookups
  @@index([employeeId, timestamp, status])  // Daily summary
  @@unique([employeeId, timestamp, type])   // Prevent duplicates
  @@map("attendance_records")
}
```

---

## 🎯 SUCCESS CRITERIA

- [ ] All queries return in <200ms for typical dataset sizes
- [ ] Attendance marking handles 10,000+ records/second
- [ ] Device sync handles 5,000+ records/second
- [ ] No N+1 query problems in service methods
- [ ] Index usage verified with EXPLAIN ANALYZE
- [ ] Load test passes all performance targets
- [ ] Memory stable under sustained load
- [ ] Zero unplanned downtime during optimization

---

## 📚 REFERENCES

- [Prisma Performance Optimization](https://www.prisma.io/docs/concepts/components/prisma-client/performance)
- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [Query Optimization](https://www.postgresql.org/docs/current/using-explain.html)
- [Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)

---

**Status:** 🚀 Ready for implementation  
**Next:** Run baseline performance tests and identify slow queries  
**Target:** 10x performance improvement across all modules
