# Notification System Documentation

## Overview
The clinic management system has a comprehensive notification system that sends emails and SMS to patients, doctors, and staff for various appointment and payment events.

## Notification Channels
- **Email**: Via Resend (configured with `RESEND_API_KEY`)
- **SMS**: Via Semaphore (Philippine SMS provider, configured with `SEMAPHORE_API_KEY`)

---

## Notification Triggers

### Registration
| Trigger | Template | Channels | When |
|---------|----------|----------|------|
| User Registration | `welcome` | Email | Immediately after signup |

### Clinic Appointments
| Trigger | Template | Channels | When |
|---------|----------|----------|------|
| Appointment Booked | `appointment_booked` | Email, SMS | Immediately after booking |
| Appointment Cancelled | `appointment_cancelled` | Email, SMS | When patient/staff cancels |

### Online Consultations
| Trigger | Template | Channels | When |
|---------|----------|----------|------|
| Checkout Started | `appointment_booked` | Email, SMS | After reservation created |
| Payment Success | `appointment_payment_success` | Email, SMS | After PayMongo confirms payment |
| Meeting Link Ready | `online_meeting_link` | Email, SMS | After appointment created |
| Payment Failed | `appointment_payment_failed` | Email | If payment rejected |

### Billing (Clinic)
| Trigger | Template | Channels | When |
|---------|----------|----------|------|
| Bill Issued | `billing_issued` | Email | After doctor finalizes bill |

### Reminders
| Trigger | Template | Channels | When |
|---------|----------|----------|------|
| 24 Hours Before | `appointment_reminder_24h` | Email, SMS | 24 hours before appointment |
| 1 Hour Before* | `appointment_reminder_6h` | Email, SMS | 1 hour before appointment |

*Reminders not yet auto-scheduled; can be triggered manually

---

## Email/SMS Templates

### 1. Welcome (Registration)
**Template**: `welcome`
```
Subject: Welcome to CHIARA Clinic
Body: Welcome! Your account is now active. You can book clinic visits and online consultations at any time.
```

### 2. Appointment Booked
**Template**: `appointment_booked`
```
Subject: Your appointment booking was received
Body: Your [clinic/online] appointment request (ref ABC12345) has been recorded.
```

### 3. Appointment Confirmed
**Template**: `appointment_confirmed`
```
Subject: Your appointment is confirmed
Body: Your appointment (ref ABC12345) is confirmed. [Meeting link: https://...]
```

### 4. Payment Success
**Template**: `appointment_payment_success`
```
Subject: Payment successful
Body: We received your payment for appointment ABC12345. Your online consultation is now secured.
```

### 5. Meeting Link
**Template**: `online_meeting_link`
```
Subject: Your online meeting link
Body: Your meeting link for appointment ABC12345 is ready: https://meet.chiara.clinic/ABC12345-xxxxx
```

### 6. Combined (Payment + Confirmed)
**Template**: `appointment_paid_and_confirmed`
```
Subject: Online consultation confirmed
Body: Payment received. Your online consultation (ref ABC12345) is confirmed. [Meeting link: https://...]
```

### 7. Payment Failed
**Template**: `appointment_payment_failed`
```
Subject: Payment could not be completed
Body: We couldn't process your payment for appointment ABC12345. Please try again to confirm your slot.
```

### 8. 24-Hour Reminder
**Template**: `appointment_reminder_24h`
```
Subject: Reminder: online consultation tomorrow
Body: This is a 24-hour reminder for your online consultation (ref ABC12345) tomorrow. [Meeting link: https://...]
```

### 9. 1-Hour Reminder
**Template**: `appointment_reminder_6h`
```
Subject: Reminder: appointment in a few hours
Body: Your appointment (ref ABC12345) is coming up soon. [Meeting link: https://...]
```

### 10. Cancellation
**Template**: `appointment_cancelled`
```
Subject: Appointment cancelled
Body: Your appointment (ref ABC12345) has been cancelled.
```

### 11. Billing Issued
**Template**: `billing_issued`
```
Subject: Your receipt is ready
Body: Your bill (ref ABC12345) has been issued. You can review it on your dashboard.
```

---

## How It Works

### Queue-Based System
1. **Enqueue**: When event occurs, notification is queued to `notifications` table
2. **Drain**: Worker endpoint processes due notifications at schedule
3. **Send**: Email/SMS providers deliver to recipients
4. **Track**: Status updated (sent/failed) in database

### Notification Flow
```
Event (appointment booked)
  ↓
enqueueNotification()
  ↓
INSERT into notifications table (status: 'queued')
  ↓
processDueNotifications() [cron or manual call]
  ↓
renderTemplate() + sendEmail()/sendSms()
  ↓
UPDATE status: 'sent' or 'failed'
```

---

## Configuration

### Environment Variables
```bash
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM=CHIARA Clinic <no-reply@chiara.clinic>

# SMS (Semaphore - Philippines)
SEMAPHORE_API_KEY=xxxxxxxxxxxxx
SEMAPHORE_SENDER_NAME=CHIARA Clinic

# Meeting Infrastructure
MEETING_BASE_URL=https://meet.chiara.clinic
```

### Cron Jobs

**Drain Notifications** - Every 5 minutes
```bash
POST /api/v2/notifications/drain
# Authorization: Vercel Cron signature
```

**Maintenance Tasks** - Every hour
```bash
POST /api/v2/maintenance/cron
# - Cleans up orphaned pending reservations (> 1 hour old)
# - Marks no-show appointments (past time)
```

---

## Database Schema

### notifications table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  channel TEXT CHECK (channel IN ('email', 'sms')),
  template TEXT,
  payload JSONB,
  status TEXT CHECK (status IN ('queued', 'sent', 'failed')),
  error TEXT,
  send_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API for Notifications

### Enqueue Notification (Server-Side Only)
```typescript
import { enqueueNotification } from "@/src/lib/services/notification";

await enqueueNotification({
  user_id: patientId,
  template: "appointment_booked",
  channels: ["email", "sms"],
  payload: { 
    appointment_id: appointmentId,
    appointment_type: "Clinic"
  },
  send_at: new Date().toISOString() // Optional: schedule for later
});
```

### Drain Notifications (Manual Trigger)
```bash
curl -X POST http://localhost:3000/api/v2/notifications/drain \
  -H "X-Vercel-Cron: your-secret"
```

---

## Best Practices

1. **Always Enqueue, Never Block**: Notifications are queued asynchronously to avoid blocking appointment/payment operations
2. **Scheduled Delivery**: Use `send_at` to schedule notifications (e.g., 24 hours before)
3. **Multiple Channels**: Combine email + SMS for critical notifications
4. **Failed Retry**: Failed notifications are logged; re-run drain endpoint periodically
5. **Payload Data**: Keep payload minimal; use IDs to look up details later

---

## Troubleshooting

### Notifications Not Sending
1. Check `RESEND_API_KEY` and `SEMAPHORE_API_KEY` are set
2. Run drain endpoint manually: `POST /api/v2/notifications/drain`
3. Check `notifications` table for `status: 'failed'` with error message
4. Verify phone numbers have country code (+63 for PH)

### Email Provider Down
- Set `RESEND_API_KEY=""` to log to console instead (stub mode)
- Check logs for `[email:stub]` entries

### SMS Provider Down  
- Set `SEMAPHORE_API_KEY=""` to log to console instead (stub mode)
- Check logs for `[sms:stub]` entries

---

## Future Enhancements
- [ ] Automatic 24-hour and 1-hour reminders
- [ ] Appointment rescheduling notifications
- [ ] No-show warning notifications
- [ ] WhatsApp integration
- [ ] In-app push notifications
- [ ] Notification preferences per patient

