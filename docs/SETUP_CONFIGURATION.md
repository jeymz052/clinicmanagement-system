# Setup & Configuration Guide

## Requirements Implemented ✅

This document covers the implementation of:
1. **Appointment Module** - Full alignment with requirements
2. **POS/Billing System** - Clinic-only payment collection
3. **Notification System** - Email & SMS for all events
4. **Maintenance Tasks** - Auto-cleanup and no-show marking

---

## Environment Configuration

### 1. Email Notifications (Resend)

**Get API Key:**
- Go to [resend.com](https://resend.com)
- Sign up for free account
- Get API key from dashboard

**Add to `.env.local`:**
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM=CHIARA Clinic <noreply@chiara.clinic>
```

### 2. SMS Notifications (Semaphore - Philippines)

**Get API Key:**
- Go to [semaphore.co](https://semaphore.co)
- Sign up for account
- Create API key
- Add sender name (optional)

**Add to `.env.local`:**
```bash
SEMAPHORE_API_KEY=xxxxxxxxxxxxxxxxxxxxx
SEMAPHORE_SENDER_NAME=CHIARA Clinic
```

### 3. Online Meeting Infrastructure

**Add to `.env.local`:**
```bash
MEETING_BASE_URL=https://meet.chiara.clinic
```

### 4. PayMongo Checkout + Webhooks

For online consultation payments, set the PayMongo credentials and the public app URL used in checkout redirects.

**Add to `.env.local`:**
```bash
APP_URL=https://your-production-domain.com
PAYMONGO_SECRET_KEY=
PAYMONGO_WEBHOOK_SECRET=
```

**Configure in PayMongo Dashboard:**
- Webhook URL: `https://your-production-domain.com/api/v2/payments/paymongo-webhook`
- Events to subscribe to:
  - `checkout_session.payment.paid`
  - `payment.paid`
  - `payment.failed`

**Notes:**
- The webhook endpoint verifies the `Paymongo-Signature` header.
- For local testing, expose your app with a tunnel (ngrok, Cloudflare Tunnel, Vercel preview URL) and use that public URL in `APP_URL` and the webhook URL.

---

## Vercel Cron Configuration

### Create `vercel.json` 

Already configured in your project. Update to enable maintenance tasks:

```json
{
  "crons": [
    {
      "path": "/api/v2/notifications/drain",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/v2/maintenance/cron",
      "schedule": "0 * * * *"
    }
  ]
}
```

This schedules:
- **Notification Drain**: Every 5 minutes (send queued notifications)
- **Maintenance Tasks**: Every hour (cleanup + no-show marking)

---

## Database Setup

The schema is already in place. Ensure these tables exist:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('billings', 'billing_items', 'payments', 'notifications');
```

If missing, run migrations from `supabase/schema.sql`.

---

## API Testing

### 1. Test Appointment Booking with Notification

```bash
# Create clinic appointment
curl -X POST http://localhost:3000/api/(dashboard)/appointments/actions.ts \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "John Doe",
    "email": "john@example.com",
    "phone": "+63 912 345 6789",
    "doctorId": "chiara-punzalan",
    "date": "2026-05-08",
    "start": "09:00",
    "type": "Clinic",
    "reason": "General checkup"
  }'

# Check notifications were queued
SELECT * FROM notifications WHERE status = 'queued' LIMIT 5;

# Manually drain (test notifications)
curl -X POST http://localhost:3000/api/v2/notifications/drain \
  -H "Authorization: Bearer $(vercel env pull | grep CRON_SECRET | cut -d= -f2)"
```

### 2. Test Billing Creation

```bash
# Create billing for clinic appointment
curl -X POST http://localhost:3000/api/v2/billing/create \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment_id": "appt-uuid",
    "patient_id": "patient-uuid",
    "items": [
      {
        "description": "Consultation",
        "quantity": 1,
        "unit_price": 350
      }
    ]
  }'

# Issue billing (triggers notification)
curl -X POST http://localhost:3000/api/v2/billing/{billing_id}/issue \
  -H "Authorization: Bearer ${TOKEN}"

# Record payment
curl -X POST http://localhost:3000/api/v2/billing/{billing_id}/payment \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 350,
    "method": "Cash",
    "reference": "POS-001"
  }'

# Get receipt
curl -X GET http://localhost:3000/api/v2/billing/{billing_id}/receipt \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3. Test Online Appointment with Payment

```bash
# Start checkout (creates reservation)
curl -X POST http://localhost:3000/api/v2/appointments/checkout \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+63 912 345 6789",
    "doctorId": "chiara-punzalan",
    "date": "2026-05-08",
    "start": "10:00",
    "reason": "Online consultation"
  }'

# Returns checkout URL to PayMongo
# After payment, webhook calls confirmPaymentByRef()
# Notifications sent: booked + payment_success + meeting_link
```

### 4. Test Maintenance Tasks

```bash
# Run maintenance manually
curl -X POST http://localhost:3000/api/v2/maintenance/cron \
  -H "Authorization: Bearer $(vercel env pull | grep CRON_SECRET | cut -d= -f2)"

# Check results
SELECT status, COUNT(*) FROM online_booking_reservations GROUP BY status;
SELECT status, COUNT(*) FROM appointments WHERE status = 'NoShow';
```

---

## Single Doctor Configuration

The system is configured for **Dra. Chiara C. Punzalan M.D.** only:

**Database UUID:** Retrieved from `doctors` table by slug `chiara-punzalan`

**Hardcoded in:** [src/lib/server/appointments-store.ts](src/lib/server/appointments-store.ts#L37)
```typescript
const ASSIGNED_DOCTOR_SLUG = "chiara-punzalan";
```

To add another doctor, you would need to:
1. Modify UI to support doctor selection
2. Update `ASSIGNED_DOCTOR_SLUG` logic to use form input
3. Update permission checks for multi-doctor scenarios

---

## Appointment Module Alignment

### ✅ Fully Implemented

| Requirement | Implementation |
|-------------|-----------------|
| Calendar booking | Date + time picker in UI |
| Select doctor, date, time | Works for single doctor + date/time |
| Max 5 patients per hour | Hard limit enforced in validation |
| Queue number auto (1–5) | Gap-fill algorithm |
| Disable full slots | Marked as full in availability |
| Suggest next available | 14-day lookahead |
| Slot conflict control | GIST constraint + app validation |
| Clinic: No advance payment | Created as "Confirmed" immediately |
| Online: Payment first | Reservation → Payment → Appointment |
| Meeting link auto-generated | UUID-based, sent via notification |

---

## POS/Billing Features

### ✅ Implemented

| Feature | Endpoint |
|---------|----------|
| Create bill | POST `/api/v2/billing/create` |
| Add line items | POST `/api/v2/billing/{id}/items` |
| Issue billing | POST `/api/v2/billing/{id}/issue` |
| Record payment | POST `/api/v2/billing/{id}/payment` |
| Generate receipt | GET `/api/v2/billing/{id}/receipt` |
| Support: Cash, Card, Transfer | `payment_method` enum |

---

## Notification Features

### ✅ Implemented

| Trigger | Template | Channels |
|---------|----------|----------|
| Registration | welcome | Email |
| Appointment booked | appointment_booked | Email, SMS |
| Appointment cancelled | appointment_cancelled | Email, SMS |
| Payment success | appointment_payment_success | Email, SMS |
| Meeting link | online_meeting_link | Email, SMS |
| Payment failed | appointment_payment_failed | Email |
| Billing issued | billing_issued | Email |

---

## Maintenance Features

### ✅ Implemented

| Task | Schedule | Effect |
|------|----------|--------|
| Cleanup orphaned reservations | Hourly | Marks Pending → Expired after 1 hour |
| Auto no-show marking | Hourly | Marks past Confirmed → NoShow |
| Queue recalculation | On cancellation | Reorders queue numbers 1, 2, 3... |

---

## Deployment Checklist

- [ ] Add `RESEND_API_KEY` to Vercel environment
- [ ] Add `SEMAPHORE_API_KEY` to Vercel environment
- [ ] Add `MEETING_BASE_URL` to Vercel environment
- [ ] Deploy `vercel.json` with cron config
- [ ] Verify database schema (all tables exist)
- [ ] Test notification drain endpoint
- [ ] Test appointment booking flow
- [ ] Test clinic billing flow
- [ ] Test online payment flow
- [ ] Monitor logs for errors

---

## Files Created/Modified

### New Services
- `src/lib/services/pos-billing.ts` - POS/Billing logic
- `src/lib/services/maintenance.ts` - Cron jobs (cleanup, no-show marking)

### New API Routes
- `app/api/v2/billing/create/route.ts` - Create billing
- `app/api/v2/billing/{id}/items/route.ts` - Add items
- `app/api/v2/billing/{id}/route.ts` - Issue, payment, receipt
- `app/api/v2/maintenance/cron/route.ts` - Maintenance tasks

### Modified Files
- `src/lib/server/appointments-store.ts` - Added queue recalculation on deletion

### Documentation
- `docs/POS_BILLING_API.md` - Billing API reference
- `docs/NOTIFICATION_SYSTEM.md` - Notification system guide
- `docs/SETUP_CONFIGURATION.md` - This file

---

## Support

For issues:
1. Check logs: `vercel logs`
2. Check notifications table for errors: `SELECT * FROM notifications WHERE status = 'failed'`
3. Verify API keys are set: `vercel env list`
4. Test endpoints manually using curl commands above

