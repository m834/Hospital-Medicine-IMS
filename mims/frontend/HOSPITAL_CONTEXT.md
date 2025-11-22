# Hospital Context System - Developer Guide

## Overview
The Hospital Context system allows Super Admin to select a specific hospital and view/manage hospital-specific data across the entire application.

## Components

### 1. **Hospital Store** (`stores/hospital.store.ts`)
Zustand store that persists selected hospital in localStorage.

```typescript
const { selectedHospital, setSelectedHospital, hospitals, setHospitals } = useHospitalStore();
```

### 2. **Hospital Selector** (`components/layout/hospital-selector.tsx`)
Dropdown component in the header (Super Admin only) to select hospital context.

### 3. **Hospital Context Hook** (`hooks/use-hospital-context.ts`)
Helper hook to get current hospital context for API calls.

## Usage Examples

### In Components
```typescript
import { useHospitalContext } from '@/hooks/use-hospital-context';

function MyComponent() {
  const { hospitalId, hospitalFilter, isHospitalSpecific, contextDescription } = useHospitalContext();
  
  // Use in API calls
  const fetchData = async () => {
    const params = {
      ...hospitalFilter, // Adds hospitalId if specific hospital selected
      // other params
    };
    const response = await api.get('/patients', { params });
  };
  
  // Conditional rendering
  if (isHospitalSpecific) {
    return <HospitalSpecificView />;
  }
  
  return <SystemWideView />;
}
```

### Direct Store Access
```typescript
import { useHospitalStore } from '@/stores/hospital.store';

function SomeComponent() {
  const { selectedHospital } = useHospitalStore();
  
  if (selectedHospital) {
    // Show hospital-specific data
    return <div>{selectedHospital.name} Data</div>;
  }
  
  // Show all hospitals
  return <div>All Hospitals</div>;
}
```

### API Integration
```typescript
// Example: Fetch patients with hospital context
const { hospitalFilter } = useHospitalContext();

const fetchPatients = async () => {
  const response = await api.get('/patients', {
    params: {
      ...hospitalFilter, // { hospitalId: 'xxx' } or {}
      page: 1,
      limit: 50,
    }
  });
};
```

## Behavior

### For Super Admin:
- **No Hospital Selected** (`selectedHospital = null`):
  - Shows system-wide data (all hospitals)
  - Stats show totals across all hospitals
  - API calls don't filter by hospitalId
  
- **Hospital Selected** (`selectedHospital = { id, name, code }`):
  - Shows hospital-specific data
  - Stats show data for selected hospital only
  - API calls include `hospitalId` filter
  - Visual indicator shows context

### For Other Roles:
- Always use their assigned `user.hospitalId`
- Hospital selector is hidden
- Cannot change hospital context

## Best Practices

1. **Always use the hook** for consistent behavior:
   ```typescript
   const { hospitalFilter } = useHospitalContext();
   ```

2. **Show context indicator** when displaying filtered data:
   ```typescript
   {selectedHospital && (
     <Alert>Viewing data for: {selectedHospital.name}</Alert>
   )}
   ```

3. **Handle both states** in components:
   - System-wide view (all hospitals)
   - Hospital-specific view (single hospital)

4. **Clear selection when appropriate**:
   ```typescript
   const { setSelectedHospital } = useHospitalStore();
   setSelectedHospital(null); // Switch to all hospitals
   ```

## Integration Checklist

When creating new features that use hospital data:

- [ ] Import `useHospitalContext` hook
- [ ] Apply `hospitalFilter` to API calls
- [ ] Show different UI based on `isHospitalSpecific`
- [ ] Add context indicator if needed
- [ ] Test with both contexts (all hospitals vs specific hospital)
- [ ] Ensure non-admin users see their hospital only

## Example: Complete Component

```typescript
'use client';

import { useHospitalContext } from '@/hooks/use-hospital-context';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export function PatientsList() {
  const { hospitalFilter, isHospitalSpecific, selectedHospital } = useHospitalContext();
  const [patients, setPatients] = useState([]);
  
  useEffect(() => {
    async function fetchPatients() {
      const response = await api.get('/patients', {
        params: { ...hospitalFilter, limit: 50 }
      });
      setPatients(response.data);
    }
    fetchPatients();
  }, [hospitalFilter]); // Re-fetch when hospital context changes
  
  return (
    <div>
      <h2>
        {isHospitalSpecific 
          ? `Patients at ${selectedHospital.name}`
          : 'All Patients (System-wide)'
        }
      </h2>
      {/* Render patients */}
    </div>
  );
}
```

## Notes

- Hospital selection persists in localStorage
- Context changes trigger re-renders in components using the store
- Super Admin can freely switch between contexts
- Other roles cannot access hospital selector
