# API Optimization Guide

## Overview
Performance optimizations implemented for government hospital deployment with large data volumes.

## 1. Database Indexes (20 indexes)

### Patient Indexes (4)
- `patients_full_name_idx` - Full name search
- `patients_mobile_idx` - Mobile number lookup
- `patients_attending_doctor_idx` - Doctor filter
- `patients_visit_type_idx` - Visit type filter

### Medicine Indexes (4)
- `medicines_generic_name_idx` - Generic name search
- `medicines_manufacturer_idx` - Manufacturer filter
- `medicines_form_idx` - Dosage form filter
- `medicines_hospital_status_idx` - Hospital + status composite

### Stock Batch Indexes (8)
- `stock_batches_batch_no_idx` - Batch number lookup
- `stock_batches_manufacturer_idx` - Manufacturer search
- `stock_batches_qty_available_idx` - Quantity sorting
- `stock_batches_storage_type_idx` - Storage filter
- `stock_batches_medicine_pharmacy_status_idx` - FIFO query composite
- `stock_batches_expiry_status_idx` - Expiring batches composite
- Additional composites for common query patterns

### Issue Transaction Indexes (4)
- `issue_transactions_issued_by_idx` - User tracking
- `issue_transactions_price_type_idx` - Price type filter
- `issue_transactions_status_idx` - Status filter
- `issue_transactions_pharmacy_date_idx` - Pharmacy + date composite

**Status**: Automatically applied via Prisma migrations in Docker deployment

## 2. In-Memory Caching

### CacheService Features
- **TTL Support**: Configurable expiration per cache entry
- **Pattern-Based Invalidation**: Regex pattern matching for bulk deletion
- **Auto-Expiration**: Expired entries removed on access
- **Statistics Tracking**: Monitor cache hit/miss rates
- **Manual Cleanup**: `cleanup()` method for maintenance

### Cache Configuration

#### MedicinesService Caching
```typescript
// Medicine List - 5 minute TTL
Key Pattern: medicines:{hospitalId}:{searchParams}
Invalidated on: create, update, delete
TTL: 5 minutes (300,000ms)

// Medicine Stats - 5 minute TTL
Key Pattern: medicines:stats:{hospitalId}
Invalidated on: create, update, delete
TTL: 5 minutes
```

#### InventoryService Caching
```typescript
// Inventory Stats - 2 minute TTL (changes frequently)
Key Pattern: inventory:stats:{hospitalId}:{pharmacyId}
Invalidated on: create, update, delete
TTL: 2 minutes (120,000ms)

// Low Stock Alerts - 3 minute TTL
Key Pattern: inventory:low-stock:{hospitalId}:{pharmacyId}:{threshold}
Invalidated on: create, update, delete
TTL: 3 minutes
```

### Cache Invalidation Strategy
- **Create Operations**: Clear all relevant caches with `deletePattern()`
- **Update Operations**: Clear all relevant caches with `deletePattern()`
- **Delete Operations**: Clear all relevant caches with `deletePattern()`
- **Pattern**: `inventory:.*:{hospitalId}:.*` or `medicines:{hospitalId}:.*`

## 3. Query Optimization

### Pagination Limits
- **Default**: 50 records per page
- **Maximum**: 200 records per page
- Prevents excessive data transfer
- Consistent across all endpoints

### Select Limiting
```typescript
// Good - Only fetch needed fields
select: {
  id: true,
  name: true,
  genericName: true,
  form: true,
  strength: true,
}

// Avoid - Fetches all fields including large text
select: {
  *: true, // or no select
}
```

### Relation Optimization
- **FIFO Queries**: Pre-filtered at database level (status, expiryDate, qtyAvailable)
- **Count Queries**: Use `_count` to avoid loading full relations
- **Parallel Queries**: `Promise.all()` for independent queries

## 4. FIFO Algorithm Optimization

### Database-Driven Sorting
```typescript
// Optimized FIFO query
const batches = await prisma.stockBatch.findMany({
  where: {
    medicineId,
    pharmacyId,
    hospitalId,
    status: 'AVAILABLE',
    qtyAvailable: { gt: 0 },
    expiryDate: { gt: new Date() }, // Index: expiry_status_idx
  },
  orderBy: { receivedDate: 'asc' }, // Index: medicine_pharmacy_status_idx
  select: { /* only needed fields */ }
});
```

### Benefits
- **Index Usage**: Composite indexes speed up WHERE + ORDER BY
- **Reduced Data Transfer**: Select only needed fields
- **Automatic Expiry Filtering**: Excludes expired batches at query level

## 5. Performance Metrics

### Expected Improvements
- **Medicine List**: ~70% faster (cache hit) after first load
- **Dashboard Stats**: ~60% faster (cache hit) with 2-5min TTL
- **Low Stock Alerts**: ~50% faster (cache hit) with 3min TTL
- **FIFO Allocation**: ~40% faster with composite indexes

### Monitoring Cache Performance
```typescript
// Get cache statistics
const stats = cacheService.getStats();
// Returns: { size: number, keys: string[] }

// Monitor in logs
Logger.log(`Cache hit: ${cacheKey}`);
Logger.log(`Cache miss: ${cacheKey}`);
```

## 6. Upgrade Path to Redis

### Current Implementation
- In-memory cache (Map-based)
- Per-instance storage (not shared across servers)
- Lost on server restart
- No memory limit enforcement

### Redis Migration (Future)
```typescript
// Replace CacheService with Redis implementation
import { Redis } from 'ioredis';

@Injectable()
export class RedisCacheService {
  constructor(private redis: Redis) {}
  
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl / 1000, JSON.stringify(value));
    } else {
      await this.redis.set(key, JSON.stringify(value));
    }
  }
  
  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### Benefits of Redis
- Shared cache across multiple backend instances
- Persistent cache (survives restarts with AOF)
- Built-in TTL and eviction policies
- Memory limit management
- Pub/Sub for cache invalidation across instances

## 7. Best Practices

### When to Cache
✅ **Do Cache**:
- Read-heavy endpoints (medicine list, stats)
- Expensive aggregations (low stock alerts)
- Rarely changing data (medicine catalog)
- Dashboard statistics

❌ **Don't Cache**:
- Write operations (create, update, delete)
- Real-time data (current stock levels)
- User-specific data (session, preferences)
- Frequently changing data (< 1 minute TTL)

### Cache Key Naming
```typescript
// Good - Descriptive and hierarchical
medicines:{hospitalId}:{searchParams}
inventory:stats:{hospitalId}:{pharmacyId}
inventory:low-stock:{hospitalId}:{pharmacyId}:{threshold}

// Bad - Ambiguous or too generic
medicine_cache
stats
alerts
```

### Cache Invalidation
```typescript
// Pattern-based deletion for related caches
this.cacheService.deletePattern(`medicines:${hospitalId}:.*`);
this.cacheService.deletePattern(`inventory:.*:${hospitalId}:.*`);

// Specific cache deletion
this.cacheService.delete(`medicines:stats:${hospitalId}`);
```

## 8. Testing Cache Effectiveness

### Test Scenarios
1. **First Request**: Should hit database, populate cache
2. **Second Request**: Should hit cache, return instantly
3. **After Update**: Cache invalidated, next request hits database
4. **After TTL Expiry**: Cache expired, request hits database

### Test Commands
```bash
# First load - cache miss (check logs)
curl http://localhost:3001/medicines?hospitalId=xxx

# Second load - cache hit (check logs, should be faster)
curl http://localhost:3001/medicines?hospitalId=xxx

# Update medicine - invalidates cache
curl -X PUT http://localhost:3001/medicines/:id

# Next load - cache miss again
curl http://localhost:3001/medicines?hospitalId=xxx
```

## 9. Deployment Considerations

### Docker Environment
- Database indexes applied automatically via Prisma migrations
- In-memory cache starts fresh on each container restart
- Consider Redis for production multi-instance deployment

### Horizontal Scaling
- In-memory cache NOT shared across instances
- Each instance has its own cache
- Redis recommended for load-balanced deployments

### Memory Management
- Current implementation has no memory limit
- Monitor cache size with `getStats()`
- Implement LRU eviction if memory becomes concern
- Upgrade to Redis for production memory management

## 10. Future Optimizations

### Planned Enhancements
1. **Redis Integration**: Shared cache across instances
2. **Database Connection Pooling**: Optimize connection usage
3. **GraphQL DataLoader**: Batch and cache database queries
4. **Response Compression**: Gzip API responses > 1KB
5. **CDN Integration**: Cache static assets and public endpoints
6. **Query Result Streaming**: Stream large datasets instead of loading all at once
7. **Elasticsearch**: Full-text search for medicines and patients

### Performance Targets
- API Response Time: < 200ms (p95)
- Database Query Time: < 50ms (p95)
- Cache Hit Rate: > 70%
- Concurrent Users: 1000+
