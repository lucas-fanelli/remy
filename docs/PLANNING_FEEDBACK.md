# Feedback Systems Planning Document

## Overview

This document outlines the technical architecture for implementing automated error tracking and user feedback systems in the Remy's application.

---

## 1. Automated Error Tracking

### Option A: Sentry Integration (Recommended)

**Why Sentry?**
- Industry-standard for Next.js applications
- Real-time error monitoring with source maps
- Performance monitoring built-in
- User session replay capabilities
- Slack/Discord notifications
- Automatic issue grouping

**Implementation Steps:**
1. Install Sentry SDK: `@sentry/nextjs`
2. Run setup wizard: `npx @sentry/wizard@latest -i nextjs`
3. Configure environment variables

**Required Environment Variables:**
```env
SENTRY_DSN=https://xxxx@o123456.ingest.sentry.io/123456
SENTRY_AUTH_TOKEN=sntrys_xxxx
SENTRY_ORG=your-org-name
SENTRY_PROJECT=remys-app
```

**Files Created by Sentry:**
- `sentry.client.config.ts` - Client-side error handling
- `sentry.server.config.ts` - Server-side error handling  
- `sentry.edge.config.ts` - Edge runtime handling
- `next.config.ts` - Modified to include Sentry webpack plugin

**Pros:**
- Zero maintenance overhead
- Rich error context (user info, breadcrumbs, stack traces)
- Performance monitoring included
- 5,000 errors/month on free tier

**Cons:**
- External dependency
- Data leaves your infrastructure

---

### Option B: Custom Prisma Error Logging

**Use Case:** If you prefer keeping all data in-house.

**Proposed Schema:**
```prisma
model ErrorLog {
  id          String   @id @default(uuid())
  level       String   // 'error', 'warning', 'info'
  message     String
  stack       String?  @db.Text
  context     Json?    // Request data, user info, etc.
  url         String?
  userId      String?
  userAgent   String?
  createdAt   DateTime @default(now())
  resolved    Boolean  @default(false)
  
  user        User?    @relation(fields: [userId], references: [id])
  
  @@index([level])
  @@index([createdAt])
  @@index([userId])
  @@map("error_logs")
}
```

**Implementation:**
- Create global error boundary component
- Add API route `/api/errors` for logging
- Create error logging service class
- Add middleware for server-side errors

**Pros:**
- Full data ownership
- No external costs
- Custom retention policies

**Cons:**
- Requires maintenance
- No source map integration
- Manual alerting setup required

---

### Recommendation

**Use Sentry for production error tracking** with a Prisma `ErrorLog` table as a backup for custom analytics and audit trails.

---

## 2. User Bug Reports & Suggestions

### Unified Feedback System

Single system handling both bug reports and feature suggestions with a `type` discriminator.

### Prisma Schema

```prisma
enum FeedbackType {
  BUG
  SUGGESTION
  QUESTION
  OTHER
}

enum FeedbackStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
  WONT_FIX
}

enum FeedbackPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model Feedback {
  id            String           @id @default(uuid())
  type          FeedbackType
  status        FeedbackStatus   @default(OPEN)
  priority      FeedbackPriority @default(MEDIUM)
  
  // Content
  title         String
  description   String           @db.Text
  screenshotUrl String?
  
  // Context (auto-captured)
  pageUrl       String?
  userAgent     String?
  appVersion    String?
  
  // User (optional - allow anonymous)
  userId        String?
  userEmail     String?          // For anonymous users who want updates
  
  // Admin response
  adminNotes    String?          @db.Text
  resolvedById  String?
  resolvedAt    DateTime?
  
  // Timestamps
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  
  // Relations
  user          User?            @relation(fields: [userId], references: [id])
  resolvedBy    User?            @relation("ResolvedFeedback", fields: [resolvedById], references: [id])
  
  @@index([type])
  @@index([status])
  @@index([userId])
  @@index([createdAt])
  @@map("feedback")
}
```

---

## 3. User Interface Design

### A. Floating Feedback Button (Global)

**Location:** Fixed position, bottom-right corner (above mobile nav on mobile)

**Design:**
```
[💬] ← Floating Action Button
  └── Opens modal with options:
      - 🐛 Report a Bug
      - 💡 Suggest a Feature  
      - ❓ Ask a Question
```

**Component:** `src/components/feedback/FeedbackButton.tsx`

### B. Feedback Modal

**Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Type | Dropdown | Yes | Bug/Suggestion/Question |
| Title | Text (100 chars) | Yes | Brief summary |
| Description | Textarea | Yes | Detailed explanation |
| Screenshot | Image Upload | No | Uses existing Cloudinary |
| Email | Email | No | For anonymous users wanting updates |

**Features:**
- Auto-captures current page URL
- Auto-captures browser info
- Pre-fills user info if logged in
- Character counters
- Image preview before submit

### C. Settings Page Link

Add "Report Issue" link to Settings page for discoverability.

---

## 4. Admin Dashboard

### Route: `/admin/feedback`

**Access Control:** Only users with `role: ADMIN` can access.

### Dashboard Features:

#### 4.1 Feedback List View
```
┌─────────────────────────────────────────────────────────┐
│ Feedback Management                    [+ Export CSV]    │
├─────────────────────────────────────────────────────────┤
│ Filter: [All Types ▼] [All Status ▼] [Search...     ]   │
├─────────────────────────────────────────────────────────┤
│ 🐛 Login button not working           OPEN    HIGH      │
│    @johndoe · 2 hours ago                              │
├─────────────────────────────────────────────────────────┤
│ 💡 Add dark mode to recipe cards      IN_PROGRESS MED   │
│    @janedoe · 1 day ago                                │
└─────────────────────────────────────────────────────────┘
```

#### 4.2 Feedback Detail View
- Full description view
- Screenshot viewer
- Status update dropdown
- Priority update dropdown
- Admin notes text area
- "Mark as Resolved" button
- "Close without fixing" option

#### 4.3 Stats Overview
- Total open bugs
- Total open suggestions
- Average resolution time
- Trend graph (optional)

---

## 5. API Endpoints

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/feedback` | Submit new feedback |
| `GET` | `/api/feedback/[id]` | Get own feedback status (auth required) |

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/feedback` | List all feedback (paginated) |
| `GET` | `/api/admin/feedback/[id]` | Get feedback details |
| `PATCH` | `/api/admin/feedback/[id]` | Update status/priority/notes |
| `DELETE` | `/api/admin/feedback/[id]` | Soft delete feedback |
| `GET` | `/api/admin/feedback/stats` | Get statistics |

---

## 6. Implementation Phases

### Phase 1: Foundation (Est. 2-3 hours)
- [ ] Add Prisma schema for `Feedback` model
- [ ] Run migration
- [ ] Create basic API routes
- [ ] Create FeedbackButton component

### Phase 2: User UI (Est. 2-3 hours)
- [ ] Implement feedback modal
- [ ] Add screenshot upload
- [ ] Add to global layout
- [ ] Add to Settings page

### Phase 3: Admin Dashboard (Est. 3-4 hours)
- [ ] Create admin feedback list page
- [ ] Create feedback detail/edit page
- [ ] Add status/priority management
- [ ] Add basic stats

### Phase 4: Sentry Integration (Est. 1-2 hours)
- [ ] Install and configure Sentry
- [ ] Test error capture
- [ ] Set up Slack notifications (optional)

---

## 7. Security Considerations

1. **Rate Limiting:** Max 5 feedback submissions per user per hour
2. **Spam Prevention:** Honeypot field or reCAPTCHA for anonymous submissions
3. **XSS Prevention:** Sanitize all user input before display
4. **Admin Access:** Verify `role === 'ADMIN'` on all admin endpoints
5. **File Validation:** Validate screenshot file types and sizes

---

## 8. Open Questions for Review

1. **Admin Role:** Do we need to add a `role` field to the User model, or use a separate Admin model?
2. **Email Notifications:** Should we send emails when feedback status changes?
3. **Public Roadmap:** Should approved suggestions be visible on a public roadmap page?
4. **Sentry Tier:** Free tier (5K errors/month) or Team tier ($26/month)?

---

## Approval

Please review this plan and provide feedback on:
- [ ] Architecture approach
- [ ] Schema design
- [ ] UI placement decisions
- [ ] Answers to open questions

Once approved, I will proceed with implementation.
