# Local Sync Service - For Offline Sub-Pharmacy Facilities

A standalone Node.js service that runs on offline sub-pharmacy computers to:
1. **Queue all local operations** when network is unavailable
2. **Automatically sync** with cloud server when network becomes available
3. **Handle conflict resolution** with visual UI for pharmacy staff

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD SERVER (Main)                      │
│  - PostgreSQL (Source of Truth)                             │
│  - Full NestJS Backend                                      │
│  - Sync API Endpoints                                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTPS (when available)
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              OFFLINE SUB-PHARMACY FACILITY                   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Local Sync Service (This Folder)                  │     │
│  │  - SQLite Database (offline queue)                 │     │
│  │  - Network Monitor                                 │     │
│  │  - Auto Sync Loop                                  │     │
│  │  - Conflict Resolution UI                          │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  NestJS Backend (Simplified)                       │     │
│  │  - PostgreSQL (Local)                              │     │
│  │  - Medicine Issuance API                           │     │
│  │  - Prescription Management                         │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Next.js Frontend                                  │     │
│  │  - Pharmacy Staff Interface                        │     │
│  │  - Works 100% Offline                              │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. **Offline-First Operation**
- All operations work WITHOUT internet
- Changes stored in local PostgreSQL + sync queue (SQLite)
- User never blocked by network issues

### 2. **Automatic Synchronization**
```
Every 30 seconds (configurable):
1. Check network connectivity
2. If online:
   - Download changes from cloud (since last sync)
   - Upload local pending operations
   - Resolve any conflicts
3. If offline:
   - Continue queuing operations
   - Show "Offline Mode" indicator in UI
```

### 3. **Conflict Resolution**

#### Automatic (Last-Write-Wins)
- Stock adjustments: Merge quantities
- Patient records: Newest timestamp wins
- Prescriptions: Flag for manual review

#### Manual (Pharmacy Manager)
- UI shows conflicting versions side-by-side
- Manager selects: Keep Local / Use Remote / Merge Both
- Decision logged for audit trail

### 4. **Network Monitor**
```typescript
// Continuously monitors connectivity
- Ping cloud server every 10s
- Detect network state changes
- Trigger sync when connection restored
- Show real-time sync status in UI
```

## Installation (Sub-Pharmacy Computer)

### Prerequisites
```bash
# Node.js 20+
node --version

# PostgreSQL 16 (local database)
postgres --version
```

### Setup
```bash
cd local-sync

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with:
# - CLOUD_API_URL (main server URL)
# - LOCAL_DB_URL (PostgreSQL connection)
# - SYNC_QUEUE_PATH (SQLite file path)
# - HOSPITAL_ID and PHARMACY_ID
```

### Run as Service
```bash
# Development
npm run start:dev

# Production (runs as background service)
npm run start:prod

# Install as Windows Service (optional)
npm run install:service
```

## How It Works

### Step 1: Local Operation Happens
```typescript
// Pharmacy staff issues medicine to patient
POST /api/issuance
{
  "patientId": "...",
  "medicineId": "...",
  "quantity": 10
}

// Backend processes normally AND queues for sync
await prisma.issueTransaction.create({ ... });
await syncQueue.push({
  type: 'CREATE',
  entity: 'IssueTransaction',
  data: { ... },
  timestamp: new Date(),
  version: 1
});
```

### Step 2: Network Available - Upload to Cloud
```typescript
// Every 30 seconds, local-sync service runs:

const pendingOps = await syncQueue.getAllPending();
// [{type: 'CREATE', entity: 'IssueTransaction', ...}, ...]

const response = await fetch(`${CLOUD_URL}/sync/upload`, {
  method: 'POST',
  body: JSON.stringify(pendingOps)
});

// Cloud queues these operations
// Processes them sequentially
// Returns conflicts if any
```

### Step 3: Download from Cloud
```typescript
const lastSync = await getLastSyncTimestamp(); // e.g., 2025-11-20T10:00:00Z

const cloudOps = await fetch(
  `${CLOUD_URL}/sync/pending/${HOSPITAL_ID}/${PHARMACY_ID}?lastSync=${lastSync}`
);

// Apply cloud operations to local database
for (const op of cloudOps) {
  if (op.type === 'CREATE') {
    await prisma[op.entity].create({ data: op.data });
  }
  // Handle conflicts...
}
```

### Step 4: Conflict Resolution
```typescript
// Example: Stock batch updated in both places

LOCAL:  { batchId: '123', qtyAvailable: 45 }
CLOUD:  { batchId: '123', qtyAvailable: 50 }

// Conflict detected!
// Show in UI:
┌─────────────────────────────────────────────────┐
│  CONFLICT: Stock Batch #123                     │
├─────────────────────────────────────────────────┤
│  Local Value:   45 units                        │
│  Cloud Value:   50 units                        │
│                                                  │
│  [ Use Local ]  [ Use Cloud ]  [ Manual Entry ] │
└─────────────────────────────────────────────────┘

// Manager decision logged:
await auditLog.create({
  action: 'CONFLICT_RESOLUTION',
  decision: 'USE_CLOUD',
  reason: 'Cloud value more recent'
});
```

## Sync Queue Schema (SQLite)

```sql
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL, -- CREATE, UPDATE, DELETE
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSON NOT NULL,
  version INTEGER NOT NULL,
  status TEXT DEFAULT 'PENDING', -- PENDING, SYNCED, FAILED, CONFLICT
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced_at DATETIME,
  error_message TEXT
);

CREATE INDEX idx_status ON sync_queue(status);
CREATE INDEX idx_created_at ON sync_queue(created_at);
```

## Configuration

### Environment Variables
```env
# Cloud Server
CLOUD_API_URL=https://main-server.hospital.gov.pk/api
CLOUD_API_TOKEN=your-secret-token

# Local Database
LOCAL_DB_URL=postgresql://user:pass@localhost:5432/mims_sub_pharmacy

# Sync Queue (SQLite for reliability)
SYNC_QUEUE_PATH=/var/lib/mims-sync/queue.db

# Hospital Identification
HOSPITAL_ID=hospital-uuid-here
PHARMACY_ID=sub-pharmacy-uuid-here

# Sync Settings
SYNC_INTERVAL_MS=30000
NETWORK_CHECK_INTERVAL_MS=10000
MAX_RETRY_ATTEMPTS=5
BATCH_SIZE=100
```

## Monitoring & Alerts

### Real-Time Dashboard
```
┌─────────────────────────────────────────────────┐
│  Sync Status: ONLINE ✓                          │
├─────────────────────────────────────────────────┤
│  Pending Operations:        5                   │
│  Last Sync:                 2 minutes ago       │
│  Conflicts Pending:         0                   │
│  Failed Operations:         0                   │
│                                                  │
│  Network Status:            Connected           │
│  Next Sync In:              28 seconds          │
└─────────────────────────────────────────────────┘
```

### Alerts
- ⚠️ Network disconnected > 1 hour
- 🔴 Sync failed 3+ times
- ⚡ 10+ pending operations
- 💥 Conflicts require manual resolution

## Testing Offline Scenario

```bash
# Terminal 1: Start local-sync service
npm run start:dev

# Terminal 2: Simulate network failure
sudo ifconfig en0 down

# Terminal 3: Make operations
curl -X POST http://localhost:3001/api/issuance -d '{...}'

# Check sync queue
sqlite3 /var/lib/mims-sync/queue.db "SELECT * FROM sync_queue;"

# Restore network
sudo ifconfig en0 up

# Watch automatic sync happen in Terminal 1 logs
# ✓ Network restored
# ✓ Uploading 15 pending operations...
# ✓ Downloading 8 cloud operations...
# ✓ Sync completed successfully
```

## Deployment

### Docker Compose (Recommended)
```yaml
version: '3.8'
services:
  local-sync:
    build: ./local-sync
    environment:
      CLOUD_API_URL: ${CLOUD_API_URL}
      LOCAL_DB_URL: postgresql://postgres:password@postgres:5432/mims
    volumes:
      - sync-queue:/var/lib/mims-sync
    restart: always
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  sync-queue:
  postgres-data:
```

### Windows Service (For Windows-based sub-pharmacies)
```bash
npm run install:service

# Service will:
# - Start automatically on boot
# - Restart on failure
# - Log to Windows Event Viewer
```

## Best Practices

1. **Regular Backups**: SQLite queue file + PostgreSQL database
2. **Monitor Sync Lag**: Alert if pending > 1000 operations
3. **Conflict Training**: Train pharmacy staff on resolution UI
4. **Network Redundancy**: Use mobile hotspot as backup
5. **Version Control**: Always increment version on updates

## Troubleshooting

### Sync Not Working
```bash
# Check logs
tail -f /var/log/mims-sync.log

# Verify network
curl https://main-server.hospital.gov.pk/health

# Reset sync queue (CAUTION: only if corrupted)
npm run reset:queue
```

### Database Lock Issues
```bash
# If SQLite queue locked
npm run unlock:queue

# Force sync restart
npm run restart:sync
```

## Future Enhancements

- [ ] Peer-to-peer sync between sub-pharmacies
- [ ] Compression for large payloads
- [ ] Incremental sync (delta changes only)
- [ ] Mobile app for sync monitoring
- [ ] AI-powered conflict resolution suggestions
