# Bulk Stock Batch Import - Example Format

## API Endpoint
`POST /inventory/batches/bulk`

## JSON Format Example

```json
{
  "hospitalId": "hospital-uuid-here",
  "batches": [
    {
      "medicineName": "Paracetamol",
      "genericName": "Acetaminophen",
      "form": "TABLET",
      "strength": "500mg",
      "medicineManufacturer": "GSK",
      "pharmacyId": "pharmacy-uuid-here",
      "batchNo": "BATCH-2024-001",
      "qtyReceived": 1000,
      "expiryDate": "2026-12-31",
      "manufacturer": "GSK Pakistan",
      "storageType": "ROOM_TEMPERATURE",
      "purchasePrice": 2.50,
      "governmentPrice": 3.00,
      "retailPrice": 5.00
    },
    {
      "medicineName": "Amoxicillin",
      "form": "CAPSULE",
      "strength": "250mg",
      "pharmacyId": "pharmacy-uuid-here",
      "batchNo": "BATCH-2024-002",
      "qtyReceived": 500,
      "expiryDate": "2025-06-30",
      "storageType": "COLD_STORAGE",
      "purchasePrice": 5.00,
      "governmentPrice": 6.00,
      "retailPrice": 10.00
    }
  ]
}
```

## Medicine Forms (Enum Values)
- TABLET
- CAPSULE
- SYRUP
- INJECTION
- CREAM
- DROPS
- OINTMENT
- POWDER
- SUSPENSION

## Storage Types (Enum Values)
- ROOM_TEMPERATURE
- COLD_STORAGE
- REFRIGERATED

## Important Notes

1. **Medicine Lookup**: The system will:
   - First try to find existing medicine by name + form (+ strength if provided)
   - If not found, automatically create a new medicine record
   - Then create the stock batch

2. **Required Fields**:
   - `medicineName` OR `medicineId` (one must be provided)
   - If using `medicineName`, `form` is required
   - `pharmacyId` (must be MAIN pharmacy)
   - `batchNo`
   - `qtyReceived`
   - `expiryDate`
   - `storageType`
   - `purchasePrice`, `governmentPrice`, `retailPrice`

3. **Optional Fields**:
   - `genericName`
   - `strength`
   - `manufacturer`
   - `medicineManufacturer`
   - `receivedDate` (defaults to current date)

4. **Response Format**:
```json
{
  "successful": [
    {
      "batchNo": "BATCH-2024-001",
      "medicineName": "Paracetamol",
      "stockBatchId": "batch-uuid"
    }
  ],
  "failed": [
    {
      "batchNo": "BATCH-2024-003",
      "medicineName": "Invalid Medicine",
      "error": "Form is required when creating from name"
    }
  ],
  "created": 2,
  "errors": 1,
  "medicinesCreated": 1
}
```

## CSV to JSON Conversion

For Excel/CSV files, you can use tools or scripts to convert to this JSON format:

**Excel Columns:**
| Medicine Name | Generic Name | Form | Strength | Pharmacy ID | Batch No | Qty | Expiry Date | Storage Type | Purchase Price | Govt Price | Retail Price |
|--------------|--------------|------|----------|-------------|----------|-----|-------------|--------------|----------------|------------|--------------|
| Paracetamol | Acetaminophen | TABLET | 500mg | abc-123 | BATCH-001 | 1000 | 2026-12-31 | ROOM_TEMPERATURE | 2.50 | 3.00 | 5.00 |

## PDF Extraction

For PDF invoices/GRNs, you'll need to:
1. Extract text/tables using PDF parsing tools
2. Map extracted data to the JSON format above
3. Submit via bulk API endpoint
