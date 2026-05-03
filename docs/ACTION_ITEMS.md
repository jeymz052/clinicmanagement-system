# Implementation Checklist - Action Items

## 🎯 Priority 1: Setup (Do First)

### 1.1 Get API Keys
- [ ] **Resend** (Email)
  - Go to https://resend.com
  - Sign up (free tier available)
  - Copy API Key from dashboard
  - Save as `RESEND_API_KEY`

- [ ] **Semaphore** (SMS - Philippines)
  - Go to https://semaphore.co
  - Create account
  - Generate API key
  - Add sender name (optional but recommended): "CHIARA Clinic"
  - Save as `SEMAPHORE_API_KEY` and `SEMAPHORE_SENDER_NAME`

### 1.2 Add Environment Variables to Vercel
```bash
# In Vercel Dashboard → Settings → Environment Variables

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM=CHIARA Clinic <noreply@chiara.clinic>
SEMAPHORE_API_KEY=xxxxxxxxxxxxxxxxxxxxx
SEMAPHORE_SENDER_NAME=CHIARA Clinic
MEETING_BASE_URL=https://meet.chiara.clinic
```

**Or via CLI:**
```bash
vercel env add RESEND_API_KEY
vercel env add SEMAPHORE_API_KEY
vercel env add SEMAPHORE_SENDER_NAME
vercel env add MEETING_BASE_URL
```

---

## 🎯 Priority 2: Deploy Code

### 2.1 Commit Changes
```bash
cd c:\Users\Admin\clinicmanagement-system
git add .
git commit -m "feat: implement POS/Billing, Notifications, and Maintenance tasks"
git push origin main
```

### 2.2 Enable Cron Jobs
Verify `vercel.json` has:
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

### 2.3 Deploy
```bash
vercel deploy --prod
```

---

## 🎯 Priority 3: Verify Database

### 3.1 Check Schema Exists
```sql
-- Run in Supabase SQL Editor

-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('billings', 'billing_items', 'payments', 'notifications');

-- Should return 4 rows
```

### 3.2 Create Sample Pricing Items (Optional)
```sql
-- Add service pricing in Supabase SQL Editor

INSERT INTO public.pricing (code, name, category, price)
VALUES 
  ('CONSULT', 'Consultation', 'Consultation', 350),
  ('CBC', 'Complete Blood Count', 'Lab', 500),
  ('XRAY', 'X-Ray Chest', 'Lab', 800),
  ('AMOX250', 'Amoxicillin 250mg', 'Medicine', 250)
ON CONFLICT DO NOTHING;
```

---

## 🎯 Priority 4: Testing

### 4.1 Test Appointment Booking (Clinic)
```bash
# Get auth token first - use dashboard login

# Book clinic appointment
curl -X POST http://localhost:3000/api/(dashboard)/appointments/actions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Test Patient",
    "email": "test@example.com",
    "phone": "+63 912 345 6789",
    "doctorId": "chiara-punzalan",
    "date": "2026-05-08",
    "start": "09:00",
    "type": "Clinic",
    "reason": "General checkup"
  }'

# Expected: Appointment created, notification queued
```

### 4.2 Test Notification Drain
```bash
# Trigger manual notification processing
curl -X POST https://your-app.vercel.app/api/v2/notifications/drain

# Check Supabase - notifications should show status 'sent'
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;
```

### 4.3 Test Billing Creation
```bash
# After appointment created, create billing
curl -X POST https://your-app.vercel.app/api/v2/billing/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment_id": "APPOINTMENT_UUID",
    "patient_id": "PATIENT_UUID",
    "items": [
      {
        "description": "Consultation",
        "quantity": 1,
        "unit_price": 350
      }
    ]
  }'

# Expected: Billing created, status 'Draft'
```

### 4.4 Test Billing Issue & Payment
```bash
# Issue billing (sends notification)
curl -X POST https://your-app.vercel.app/api/v2/billing/BILLING_UUID/issue \
  -H "Authorization: Bearer YOUR_TOKEN"

# Record payment
curl -X POST https://your-app.vercel.app/api/v2/billing/BILLING_UUID/payment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 350,
    "method": "Cash",
    "reference": "POS-001"
  }'

# Get receipt
curl -X GET https://your-app.vercel.app/api/v2/billing/BILLING_UUID/receipt \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.5 Test Maintenance Cron
```bash
# Trigger maintenance manually
curl -X POST https://your-app.vercel.app/api/v2/maintenance/cron

# Response should show orphaned reservations cleaned + no-shows marked
```

---

## 🎯 Priority 5: Monitoring

### 5.1 Check Notification Logs
```sql
-- See all notifications (sent, failed, queued)
SELECT status, COUNT(*) 
FROM notifications 
GROUP BY status;

-- See failed notifications with errors
SELECT id, template, error, send_at 
FROM notifications 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 10;
```

### 5.2 Monitor Appointments
```sql
-- Check appointments and queue numbers
SELECT 
  id, 
  appointment_date, 
  start_time, 
  appointment_type, 
  queue_number, 
  status 
FROM appointments 
WHERE appointment_date >= NOW()::date
ORDER BY appointment_date, start_time, queue_number;
```

### 5.3 Check Billings
```sql
-- See all billings and their status
SELECT 
  b.id, 
  b.appointment_id, 
  b.total, 
  b.status, 
  COUNT(p.id) as payment_count
FROM billings b
LEFT JOIN payments p ON b.id = p.billing_id
GROUP BY b.id
ORDER BY b.created_at DESC;
```

---

## 📋 Quick Reference Commands

```bash
# View environment variables
vercel env list

# Pull latest env to .env.local
vercel env pull .env.local

# View deployment logs
vercel logs

# Check cron job execution
vercel cron list

# View production URL
vercel --prod
```

---

## ✅ Completion Checklist

- [ ] Get Resend API key
- [ ] Get Semaphore API key
- [ ] Add environment variables to Vercel
- [ ] Commit and push code
- [ ] Deploy to production
- [ ] Verify database schema exists
- [ ] Add sample pricing items (optional)
- [ ] Test clinic appointment booking
- [ ] Test notification drain
- [ ] Test billing creation
- [ ] Test billing issue & payment
- [ ] Test maintenance cron
- [ ] Monitor notification logs
- [ ] Monitor appointment logs
- [ ] Monitor billing logs

---

## 🆘 Troubleshooting

### Notifications Not Sending?
1. Check `RESEND_API_KEY` is set: `vercel env list`
2. Run drain manually: `POST /api/v2/notifications/drain`
3. Check failed notifications: `SELECT * FROM notifications WHERE status = 'failed'`
4. Verify email addresses have valid domains

### Cron Jobs Not Running?
1. Check `vercel.json` has cron paths
2. Verify cron secret is configured
3. Check logs: `vercel logs --tail`
4. Run manually to test: `curl -X POST https://your-app/api/v2/maintenance/cron`

### Billing Not Created?
1. Verify appointment exists and is clinic type
2. Check user has `payments.pos` permission
3. Verify all required fields in request body
4. Check API response for error details

### Queue Numbers Wrong?
1. Cancellation should trigger recalculation
2. Check: `SELECT * FROM appointments WHERE doctor_id = 'xxx' AND appointment_date = '2026-05-08'`
3. Queue numbers should be sequential: 1, 2, 3, 4, 5

---

## 📞 Support Resources

- **Resend Docs**: https://resend.com/docs
- **Semaphore Docs**: https://semaphore.co/api/v4
- **Vercel Cron**: https://vercel.com/docs/crons
- **Supabase SQL Editor**: https://supabase.com/dashboard

---

## Next Steps After Completion

1. **Set up 24-hour reminders** - Implement automatic reminder scheduling
2. **Configure meeting infrastructure** - Set up Jitsi/Zoom for online consultations
3. **Enable doctor scheduling** - Multi-doctor support in UI
4. **Add refund workflow** - For cancelled online appointments
5. **Set up waitlist** - Auto-book when slots open
