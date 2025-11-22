# 🌐 OFFLINE-FIRST ARCHITECTURE GUIDE
## Hospital Medicine IMS - Cloud ↔ Offline Synchronization

---

## 🎯 **CORE PRINCIPLE**

> **"Every sub-pharmacy MUST work 100% offline. Network is a BONUS, not a requirement."**

The system is designed to handle:
- ✅ **Complete offline operation** for days/weeks if needed
- ✅ **Automatic sync** when network becomes available
- ✅ **Conflict resolution** when same data modified in both places
- ✅ **Zero data loss** - all operations queued and persisted

---

## 📐 **SYSTEM ARCHITECTURE**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLOUD SERVER (Main)                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (Source of Truth)                                  │  │
│  │  - All hospitals' data                                         │  │
│  │  - Multi-tenant with hospital_id scoping                       │  │
│  │  - Row-Level Security (RLS)                                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  NestJS Backend                                                │  │
│  │  - Full API (Auth, Patients, Medicines, Inventory, Reports)   │  │
│  │  - Sync Orchestration                                          │  │
│  │  - Conflict Detection & Resolution                             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Sync API Endpoints                                            │  │
│  │  GET  /sync/pending/:hospitalId/:pharmacyId                    │  │
│  │  POST /sync/upload                                             │  │
│  │  GET  /sync/stats/:hospitalId                                  │  │
│  │  POST /sync/conflicts/:id/resolve                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ HTTPS (When Available)
                                │ TLS 1.3 + Certificate Pinning
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│              SUB-PHARMACY FACILITY (Offline-First)                   │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Local Sync Service (mims/local-sync)                         │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │  SQLite Sync Queue                                       │ │  │
│  │  │  - All pending operations                                │ │  │
│  │  │  - Retry tracking                                        │ │  │
│  │  │  - Conflict staging                                      │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │  Network Monitor                                         │ │  │
│  │  │  - Ping cloud every 10s                                  │ │  │
│  │  │  - Detect connection restore                             │ │  │
│  │  │  - Auto-trigger sync                                     │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │  Sync Engine                                             │ │  │
│  │  │  - Upload pending ops (every 30s)                        │ │  │
│  │  │  - Download cloud changes                                │ │  │
│  │  │  - Exponential backoff on failure                        │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                │                                      │
│                                │ Local HTTP                           │
│                                │                                      │
│  ┌────────────────────────────▼───────────────────────────────────┐  │
│  │  PostgreSQL (Local Copy)                                       │  │
│  │  - Hospital's pharmacy data only                               │  │
│  │  - Full schema (same as cloud)                                 │  │
│  │  - Offline operations applied instantly                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  NestJS Backend (Simplified)                                   │  │
│  │  - Core modules only (Auth, Patients, Medicines, Issuance)    │  │
│  │  - Every mutation calls: await syncService.queueOperation()   │  │
│  │  - Reads from local DB only                                   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Next.js Frontend                                              │  │
│  │  - Pharmacy Staff Interface                                    │  │
│  │  - Real-time sync status indicator                             │  │
│  │  - Offline mode banner                                         │  │
│  │  - Conflict resolution UI                                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 **SYNCHRONIZATION WORKFLOW**

### **Scenario 1: Offline Operation (No Network)**

```typescript
// Pharmacy staff issues medicine to patient

1. Frontend: POST /api/issuance
   {
     "nrNumber": "NR-20251120-0001",
     "medicineId": "med-123",
     "quantity": 10
   }

2. Backend (Local):
   a) Validate business rules
   b) Create IssueTransaction in local PostgreSQL
   c) Update StockBatch.qtyAvailable
   d) Queue sync operation:
      
      await syncService.queueOperation({
        hospitalId: "hospital-1",
        pharmacyId: "sub-pharmacy-2",
        operationType: "CREATE",
        entityType: "IssueTransaction",
        entityId: "issue-xyz",
        payload: { /* full data */ },
        version: 1
      });
      
      // Saved to SQLite queue:
      sync_queue table:
      | id | operation_type | entity_type | entity_id | status  | created_at |
      |----|----------------|-------------|-----------|---------|------------|
      | 1  | CREATE         | IssueTransaction | issue-xyz | PENDING | 2025-11-20 |

3. Response to frontend: Success (instant, no network needed)

4. Local Sync Service:
   - Every 30 seconds: Check network
   - Network offline → Skip sync
   - Queue grows: 1 → 5 → 50 → 500 operations
   - System continues working perfectly
```

### **Scenario 2: Network Restored (Auto-Sync)**

```typescript
// Network comes back online after 3 hours

1. Network Monitor detects connectivity:
   isOnline: false → true
   
2. Trigger immediate sync:
   
   a) UPLOAD Phase:
      - Fetch pending operations from SQLite queue
      - Batch size: 100 operations
      - POST to cloud: /sync/upload
      
      Request:
      [
        {
          hospitalId: "hospital-1",
          pharmacyId: "sub-pharmacy-2",
          operationType: "CREATE",
          entityType: "IssueTransaction",
          entityId: "issue-xyz",
          payload: { /* full data */ },
          version: 1
        },
        // ... 99 more operations
      ]
      
      Cloud Response:
      {
        queued: 98,
        failed: 0,
        conflicts: 2
      }
      
   b) DOWNLOAD Phase:
      - GET from cloud: /sync/pending/hospital-1/sub-pharmacy-2?lastSync=2025-11-20T07:00:00Z
      - Cloud returns operations created on other pharmacies or main pharmacy
      - Apply to local database
      
      Example: Main pharmacy created new medicine:
      {
        operationType: "CREATE",
        entityType: "Medicine",
        payload: {
          id: "med-999",
          name: "Paracetamol 500mg",
          ...
        }
      }
      
      Local backend applies:
      await prisma.medicine.create({ data: payload });
      
   c) Mark operations as synced:
      UPDATE sync_queue SET status = 'SYNCED', synced_at = NOW() WHERE id IN (...)

3. Repeat until all pending operations synced
```

### **Scenario 3: Conflict Detection**

```typescript
// Same stock batch updated in both cloud and offline pharmacy

LOCAL (offline):
  StockBatch #123:
  - qtyAvailable: 50 → 45 (issued 5 units)
  - version: 1 → 2
  - updatedAt: 2025-11-20 08:00

CLOUD (from main pharmacy):
  StockBatch #123:
  - qtyAvailable: 50 → 40 (issued 10 units)
  - version: 1 → 2
  - updatedAt: 2025-11-20 08:05

// When sync happens:

1. Cloud receives local update (v2):
   - Checks current version in database
   - Current version: 2 (already updated by main pharmacy)
   - Conflict detected! (local v2 vs cloud v2)

2. Cloud marks sync operation as CONFLICT:
   UPDATE sync_operations 
   SET status = 'CONFLICT',
       conflict_resolution = {
         "localVersion": 2,
         "remoteVersion": 2,
         "localData": { qtyAvailable: 45 },
         "remoteData": { qtyAvailable: 40 },
         "timestamp": "2025-11-20T08:10:00Z"
       }

3. Local sync service downloads conflict:
   - Saves to SQLite queue with status='CONFLICT'
   - Triggers alert to pharmacy manager

4. Pharmacy Manager UI shows:
   
   ┌────────────────────────────────────────────────────┐
   │  ⚠️  CONFLICT: Stock Batch #123 - Paracetamol     │
   ├────────────────────────────────────────────────────┤
   │  Field: qtyAvailable                               │
   │                                                    │
   │  🏥 Main Pharmacy (Cloud):   40 units              │
   │     Updated: 2025-11-20 08:05                      │
   │     By: Admin User                                 │
   │                                                    │
   │  💊 Sub Pharmacy (Local):    45 units              │
   │     Updated: 2025-11-20 08:00                      │
   │     By: Staff User                                 │
   │                                                    │
   │  Resolution:                                       │
   │  ⚪ Use Main Pharmacy Value (40)                   │
   │  ⚪ Use Sub Pharmacy Value (45)                    │
   │  ⚪ Manual Entry: [___] units                      │
   │                                                    │
   │  Reason: [_____________________________]           │
   │                                                    │
   │  [Cancel]              [Resolve Conflict]          │
   └────────────────────────────────────────────────────┘

5. Manager selects resolution:
   - Option A: Use Main Pharmacy → qtyAvailable = 40
   - Option B: Use Sub Pharmacy → qtyAvailable = 45
   - Option C: Manual (investigate) → qtyAvailable = 35 (actual physical count)

6. POST /sync/conflicts/:syncOpId/resolve
   {
     resolution: "MERGE",
     mergedData: { qtyAvailable: 35 },
     reason: "Physical count confirmed 35 units"
   }

7. Cloud applies resolution + audit log
```

---

## 🏗️ **IMPLEMENTATION CHECKLIST**

### **Backend (NestJS)**

#### 1. **Sync Module**
- [x] `SyncService` - Core sync orchestration
- [x] `SyncController` - API endpoints
- [x] `SyncInterceptor` - Auto-queue on mutations
- [ ] `SyncGuard` - Validate sync tokens
- [ ] `ConflictResolver` - Intelligent conflict handling

#### 2. **Every Entity Module**
```typescript
// Example: MedicineService

@Injectable()
export class MedicineService {
  constructor(
    private prisma: PrismaService,
    private syncService: SyncService,
  ) {}

  async create(data: CreateMedicineDto, context: RequestContext) {
    // Create in local database
    const medicine = await this.prisma.medicine.create({ data });

    // Queue for sync
    await this.syncService.queueOperation({
      hospitalId: context.hospitalId,
      pharmacyId: context.pharmacyId,
      operationType: 'CREATE',
      entityType: 'Medicine',
      entityId: medicine.id,
      payload: medicine,
      version: 1,
    });

    return medicine;
  }

  async update(id: string, data: UpdateMedicineDto, context: RequestContext) {
    // Optimistic locking with version
    const current = await this.prisma.medicine.findUnique({ where: { id } });
    
    const medicine = await this.prisma.medicine.update({
      where: { id, version: current.version },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });

    // Queue for sync
    await this.syncService.queueOperation({
      hospitalId: context.hospitalId,
      pharmacyId: context.pharmacyId,
      operationType: 'UPDATE',
      entityType: 'Medicine',
      entityId: medicine.id,
      payload: medicine,
      version: medicine.version,
    });

    return medicine;
  }
}
```

#### 3. **Database Versioning**
```prisma
// Add to EVERY entity in schema.prisma

model Medicine {
  id        String @id @default(uuid())
  // ... existing fields
  
  version   Int    @default(1)  // ← ADD THIS
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### **Local Sync Service**

#### 1. **Installation**
- [x] package.json with dependencies
- [x] TypeScript configuration
- [x] SQLite queue schema
- [x] Network monitor
- [x] Sync engine
- [ ] Windows service wrapper
- [ ] systemd service (Linux)

#### 2. **Configuration**
- [x] .env.example template
- [ ] Hospital/Pharmacy ID setup script
- [ ] SSL certificate for cloud connection
- [ ] Logging configuration

#### 3. **Monitoring**
- [x] Status endpoint (/status)
- [ ] Prometheus metrics export
- [ ] Alert webhooks (email/SMS)
- [ ] Dashboard UI (React)

### **Frontend (Next.js)**

#### 1. **Sync Status Indicator**
```typescript
// components/SyncStatus.tsx

export function SyncStatus() {
  const { data: status } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3002/status');
      return res.json();
    },
    refetchInterval: 5000, // Update every 5s
  });

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-md",
      status?.network.isOnline ? "bg-green-100" : "bg-yellow-100"
    )}>
      {status?.network.isOnline ? (
        <>
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-800">Online</span>
          <span className="text-xs text-green-600">
            {status.queue.PENDING} pending
          </span>
        </>
      ) : (
        <>
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <span className="text-sm text-yellow-800">Offline Mode</span>
          <span className="text-xs text-yellow-600">
            {status.queue.PENDING} queued
          </span>
        </>
      )}
    </div>
  );
}
```

#### 2. **Conflict Resolution UI**
- [ ] Conflict list page
- [ ] Side-by-side comparison
- [ ] Resolution form
- [ ] Audit trail viewer

---

## 📊 **MONITORING & ALERTS**

### **Key Metrics**

1. **Sync Lag**
   - `pending_operations_count`
   - `oldest_pending_operation_age`
   - Alert if > 1000 operations or > 24 hours

2. **Network Status**
   - `network_uptime_percentage`
   - `offline_duration_seconds`
   - Alert if offline > 1 hour

3. **Conflict Rate**
   - `conflicts_per_hour`
   - `unresolved_conflicts_count`
   - Alert if > 10 unresolved

4. **Sync Performance**
   - `sync_duration_seconds`
   - `operations_per_second`
   - `error_rate`

### **Dashboard Example**
```
┌─────────────────────────────────────────────────────────┐
│  Hospital Medicine IMS - Sync Dashboard                 │
├─────────────────────────────────────────────────────────┤
│  Network:       ● ONLINE                                │
│  Last Sync:     2 minutes ago                           │
│  Sync Lag:      0 seconds ✓                             │
│                                                          │
│  ┌───────────────────┬──────────────────────┐           │
│  │ Pending Ops       │ Synced (24h)         │           │
│  │ 0                 │ 1,247                │           │
│  └───────────────────┴──────────────────────┘           │
│                                                          │
│  ┌───────────────────┬──────────────────────┐           │
│  │ Conflicts         │ Failed Ops           │           │
│  │ 0                 │ 0                    │           │
│  └───────────────────┴──────────────────────┘           │
│                                                          │
│  Network Uptime (7 days): ▓▓▓▓▓▓▓▓▓▓▓░░ 92%            │
│                                                          │
│  Recent Operations:                                      │
│  ✓ IssueTransaction  #123   2 min ago   SYNCED          │
│  ✓ StockBatch        #456   5 min ago   SYNCED          │
│  ✓ Patient           #789   8 min ago   SYNCED          │
└─────────────────────────────────────────────────────────┘
```

---

## 🧪 **TESTING OFFLINE SCENARIOS**

### **Test 1: Complete Offline Operation**
```bash
# 1. Disable network
sudo ifconfig en0 down

# 2. Perform operations
curl -X POST http://localhost:3001/api/issuance -d '{...}'
# ✓ Should work instantly

# 3. Check sync queue
curl http://localhost:3002/status
# Should show PENDING operations

# 4. Re-enable network
sudo ifconfig en0 up

# 5. Watch logs - sync should auto-trigger
tail -f logs/sync.log
# ✓ Network restored
# ✓ Uploading 15 operations...
# ✓ Sync completed
```

### **Test 2: Conflict Resolution**
```bash
# 1. Update same entity in both cloud and offline
# Cloud: Update StockBatch #123 qty to 40
# Local: Update StockBatch #123 qty to 45

# 2. Trigger sync
curl -X POST http://localhost:3001/sync/trigger

# 3. Check for conflicts
curl http://localhost:3002/status
# conflicts: 1

# 4. Resolve via UI
# Frontend: Select resolution and submit
```

---

## 🚀 **DEPLOYMENT GUIDE**

### **Sub-Pharmacy Setup (One-Time)**

```bash
# 1. Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install PostgreSQL 16
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install postgresql-16

# 3. Clone repository
git clone https://github.com/hospital/mims.git
cd mims

# 4. Setup backend
cd backend
npm install
cp .env.example .env
# Edit .env with local database

# 5. Setup local-sync
cd ../local-sync
npm install
cp .env.example .env
# Edit .env with:
# - CLOUD_API_URL (main server)
# - HOSPITAL_ID (from admin)
# - PHARMACY_ID (from admin)

# 6. Initialize database
cd ../backend
npm run prisma:migrate
npm run seed

# 7. Start services
# Terminal 1: Backend
npm run start:prod

# Terminal 2: Local Sync
cd ../local-sync
npm run start:prod

# Terminal 3: Frontend
cd ../frontend
npm run build
npm run start

# 8. Install as system services
sudo npm run install:service
```

---

## ✅ **SUCCESS CRITERIA**

1. ✅ Pharmacy staff can issue medicine WITHOUT internet
2. ✅ All operations automatically sync when network available
3. ✅ Conflicts detected and resolved (manual or auto)
4. ✅ Zero data loss even after days offline
5. ✅ Real-time sync status visible to staff
6. ✅ Audit trail of all sync operations
7. ✅ Performance: < 100ms for local operations
8. ✅ Reliability: 99.9% uptime (excluding network outages)

---

**This offline-first architecture ensures your Hospital Medicine IMS works reliably in both cloud-connected and no-network environments!** 🏥💊
