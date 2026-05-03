# POS/Billing System API Documentation

## Overview
The POS/Billing system handles clinic appointment billing and payment collection. It's designed for in-person payments at the clinic using various payment methods (Cash, Transfer, Card).

## Key Features
- ✅ Create billing records for clinic appointments
- ✅ Add multiple line items (Consultation, Lab, Medicine)
- ✅ Support multiple payment methods (Cash, Card, Transfer)
- ✅ Generate receipts for patients
- ✅ Automatic notification on billing issuance
- ✅ Queue number recalculation after cancellations

---

## API Endpoints

### 1. Create Billing Record
**POST** `/api/v2/billing/create`

Create a new billing record for a clinic appointment.

**Request:**
```json
{
  "appointment_id": "uuid",
  "patient_id": "uuid",
  "items": [
    {
      "description": "Consultation",
      "quantity": 1,
      "unit_price": 350
    }
  ],
  "discount": 0,
  "tax": 0
}
```

**Response:**
```json
{
  "ok": true,
  "billing": {
    "id": "uuid",
    "appointment_id": "uuid",
    "patient_id": "uuid",
    "subtotal": 350,
    "discount": 0,
    "tax": 0,
    "total": 350,
    "status": "Draft",
    "issued_at": null,
    "created_at": "2026-05-01T10:00:00Z"
  }
}
```

---

### 2. Add Billing Items
**POST** `/api/v2/billing/{billing_id}/items`

Add line items to a draft billing.

**Request:**
```json
{
  "items": [
    {
      "description": "Lab Test - Complete Blood Count",
      "quantity": 1,
      "unit_price": 500
    },
    {
      "description": "Medicine - Amoxicillin",
      "quantity": 1,
      "unit_price": 250
    }
  ]
}
```

**Response:**
```json
{
  "ok": true
}
```

---

### 3. Issue Billing
**POST** `/api/v2/billing/{billing_id}/issue`

Mark billing as "Issued" and send notification to patient. Only draft billings can be issued.

**Response:**
```json
{
  "ok": true
}
```

---

### 4. Record Payment
**POST** `/api/v2/billing/{billing_id}/payment`

Record a payment for an issued billing.

**Request:**
```json
{
  "amount": 350,
  "method": "Cash",
  "reference": "POS-001"
}
```

**Payment Methods:**
- `Cash` - Cash payment
- `Card` - Credit/Debit card
- `BankTransfer` - Bank transfer
- `GCash` - GCash (Philippines)
- `QR` - QR code payment

**Response:**
```json
{
  "ok": true,
  "payment": {
    "id": "uuid",
    "billing_id": "uuid",
    "amount": 350,
    "method": "Cash",
    "status": "Paid",
    "paid_at": "2026-05-01T10:15:00Z"
  }
}
```

---

### 5. Generate Receipt
**GET** `/api/v2/billing/{billing_id}/receipt`

Get receipt data for printing or emailing to patient.

**Response:**
```json
{
  "ok": true,
  "receipt": {
    "id": "uuid",
    "issued_at": "2026-05-01T10:00:00Z",
    "patient_name": "John Doe",
    "patient_email": "john@example.com",
    "patient_phone": "+63 9XX XXX XXXX",
    "items": [
      {
        "description": "Consultation",
        "quantity": 1,
        "unit_price": 350,
        "total": 350
      },
      {
        "description": "Lab Test",
        "quantity": 1,
        "unit_price": 500,
        "total": 500
      }
    ],
    "subtotal": 850,
    "discount": 0,
    "tax": 0,
    "total": 850,
    "payments": [
      {
        "method": "Cash",
        "amount": 850,
        "date": "2026-05-01T10:15:00Z",
        "reference": "POS-001"
      }
    ]
  }
}
```

---

## Workflow Example

### Step 1: After Clinic Consultation
```bash
curl -X POST http://localhost:3000/api/v2/billing/create \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment_id": "appt-123",
    "patient_id": "patient-456",
    "items": [
      {
        "description": "Consultation",
        "quantity": 1,
        "unit_price": 350
      }
    ]
  }'
```

### Step 2: Add Lab/Medicine Services
```bash
curl -X POST http://localhost:3000/api/v2/billing/bill-123/items \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "description": "Complete Blood Count",
        "quantity": 1,
        "unit_price": 500
      }
    ]
  }'
```

### Step 3: Issue Bill
```bash
curl -X POST http://localhost:3000/api/v2/billing/bill-123/issue \
  -H "Authorization: Bearer ${TOKEN}"
```

### Step 4: Record Payment
```bash
curl -X POST http://localhost:3000/api/v2/billing/bill-123/payment \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 850,
    "method": "Cash",
    "reference": "POS-001"
  }'
```

### Step 5: Print Receipt
```bash
curl -X GET http://localhost:3000/api/v2/billing/bill-123/receipt \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Required Permissions
All billing endpoints require role-based permission:
- **POS Payment Management**: `payments.pos`
  - Create bills, add items, issue, record payments
- **Payment View**: `payments.view`
  - Generate receipts

---

## Billing Status Flow
```
Draft → Issue → Paid
```

- **Draft**: Billing created, can add items
- **Issued**: Billing ready for payment, patient notified
- **Paid**: Payment recorded
- **Void**: (for cancellations) Billing cancelled

---

## Notifications Sent
When a bill is issued, the patient receives:
- Email notification with billing details
- Triggers template: `billing_issued`

---

## Database Tables Used
- `billings` - Main billing record
- `billing_items` - Line items
- `payments` - Payment records
- `pricing` - Service pricing reference

