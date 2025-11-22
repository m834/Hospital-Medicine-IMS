# Default System Credentials

This document contains the default credentials created by the database seed script.

**⚠️ IMPORTANT:** These are development/demo credentials. **Change all passwords immediately in production!**

## Running the Seed Script

To create the default users, hospitals, and pharmacies:

```bash
cd mims/backend
npm run prisma:seed
```

---

## Super Admin

The Super Admin has access to **all hospitals** and can create new hospitals and assign Hospital Admins.

**Role:** `SUPER_ADMIN`  
**Email:** `admin@mims.com`  
**Password:** `Admin@12345`  
**Hospital ID:** `null` (not tied to any specific hospital)  
**Access:** All hospitals, all features

### Super Admin Capabilities:
- ✅ Create and manage hospitals
- ✅ Assign Hospital Admins to hospitals
- ✅ View all data across all hospitals
- ✅ Access all system features
- ✅ System-wide reports and analytics

---

## Hospital Admins

Hospital Admins are assigned to specific hospitals and manage all operations within their hospital.

### City General Hospital (CGH001)

**Role:** `HOSPITAL_ADMIN`  
**Email:** `admin@cgh001.com`  
**Password:** `Admin@12345`  
**Hospital:** City General Hospital  
**Hospital Code:** CGH001  

**Pharmacies:**
- Main Pharmacy (CGH001-MAIN)
- Emergency Pharmacy (CGH001-EMRG)
- Ward Pharmacy (CGH001-WARD)

### District Medical Center (DMC002)

**Role:** `HOSPITAL_ADMIN`  
**Email:** `admin@dmc002.com`  
**Password:** `Admin@12345`  
**Hospital:** District Medical Center  
**Hospital Code:** DMC002  

**Pharmacies:**
- Main Pharmacy (DMC002-MAIN)
- Emergency Pharmacy (DMC002-EMRG)
- Ward Pharmacy (DMC002-WARD)

### Hospital Admin Capabilities:
- ✅ Create and manage users (pharmacists, doctors, staff)
- ✅ Manage medicines and inventory for their hospital
- ✅ View hospital-wide reports (daily, 15-day, monthly, yearly)
- ✅ Manage pharmacies within their hospital
- ✅ View all patient data for their hospital
- ❌ Cannot access other hospitals' data
- ❌ Cannot create new hospitals

---

## Authentication Flow

### 1. Login as Super Admin
```bash
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "admin@mims.com",
  "password": "Admin@12345"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@mims.com",
    "fullName": "Super Administrator",
    "role": "SUPER_ADMIN",
    "hospitalId": null,
    "pharmacyId": null
  },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

### 2. Login as Hospital Admin
```bash
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "admin@cgh001.com",
  "password": "Admin@12345"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@cgh001.com",
    "fullName": "City General Hospital Administrator",
    "role": "HOSPITAL_ADMIN",
    "hospitalId": "hospital-uuid",
    "pharmacyId": null
  },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

---

## Role Hierarchy

```
SUPER_ADMIN (System-wide access, no hospital assignment)
    │
    ├─ Create Hospitals
    │
    └─ Assign HOSPITAL_ADMIN to each hospital
            │
            ├─ MAIN_PHARMACY_MANAGER (Main pharmacy)
            ├─ SUB_PHARMACY_MANAGER (Sub-pharmacies)
            ├─ DOCTOR
            ├─ DOCTOR_ASSISTANT
            ├─ REGISTRATION_STAFF
            ├─ PHARMACY_STAFF
            └─ AUDITOR
```

---

## Creating Additional Users

### Create Hospital Admin (Super Admin Only)

```bash
POST http://localhost:3001/auth/register
Authorization: Bearer <super-admin-token>
Content-Type: application/json

{
  "email": "admin@newhospital.com",
  "password": "SecurePassword@123",
  "fullName": "New Hospital Administrator",
  "phone": "+92-300-9999999",
  "role": "HOSPITAL_ADMIN",
  "hospitalId": "hospital-uuid-here"
}
```

### Create Pharmacy Manager (Hospital Admin)

```bash
POST http://localhost:3001/auth/register
Authorization: Bearer <hospital-admin-token>
Content-Type: application/json

{
  "email": "pharmacy.manager@cgh001.com",
  "password": "SecurePassword@123",
  "fullName": "Main Pharmacy Manager",
  "phone": "+92-300-8888888",
  "role": "MAIN_PHARMACY_MANAGER",
  "hospitalId": "hospital-uuid",
  "pharmacyId": "pharmacy-uuid"
}
```

---

## Security Notes

### Password Requirements:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (@$!%*?&#)

### Token Expiry:
- **Access Token:** 30 minutes
- **Refresh Token:** 7 days

### Password Hashing:
- Algorithm: Argon2id (industry-standard)
- Automatically handled by the backend

---

## Changing Default Passwords

After first login, users should change their password:

```bash
POST http://localhost:3001/auth/change-password
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "currentPassword": "Admin@12345",
  "newPassword": "MyNewSecurePassword@123"
}
```

---

## Reset Database (Development Only)

⚠️ **WARNING:** This will delete all data and recreate the database with default seed data.

```bash
cd mims/backend

# Reset database (drop all tables)
npx prisma migrate reset

# This will automatically run migrations and seed script
```

---

## Production Deployment

**Before deploying to production:**

1. ✅ Change all default passwords
2. ✅ Update JWT secrets in `.env`
3. ✅ Enable MFA for Super Admin accounts
4. ✅ Disable automatic seeding in production
5. ✅ Use strong, unique passwords for all accounts
6. ✅ Implement IP whitelisting for admin accounts
7. ✅ Enable audit logging for all admin actions

---

## Support

For questions or issues, contact the development team.

**Last Updated:** November 20, 2025
