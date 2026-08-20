# Signup and Onboarding Flow

## Signup Steps

### Step 1: Account Creation
**Event:** `signup_started`
- User navigates to signup page
- Displays registration form with fields:
  - Email address
  - Password (with strength indicator)
  - Full name
  - Company (optional)
  - Industry (optional)
- Form validation in real-time
- **Analytics:** Track form_viewed, form_focused

### Step 2: Email Verification
**Event:** `email_verification_initiated`
- After form submission, confirmation email is sent to user's email address
- Email contains unique verification link (expires in 24 hours)
- User clicks link to verify email
- **Analytics:** Track verification_email_sent, verification_link_clicked

### Step 3: Email Verification Confirmation
**Event:** `email_verified`
- System validates verification token
- Display success message
- Redirect to onboarding flow
- **Analytics:** Track verification_completed, verification_status

### Step 4: Signup Completion
**Event:** `signup_completed`
- Account marked as active in system
- User logged in automatically
- Welcome email delivered
- **Analytics:** Track signup_completed, account_created

## Onboarding Checklist

### First-Run Experience
1. **Dashboard Walkthrough** (Optional)
   - Event: `onboarding_dashboard_started`
   - Guided tour of main dashboard features
   - Highlight key metrics and controls
   - Event: `onboarding_dashboard_completed`

2. **Profile Setup**
   - Event: `onboarding_profile_setup_started`
   - User adds avatar (optional)
   - User confirms company information
   - User sets preferences
   - Event: `onboarding_profile_setup_completed`

3. **First Scan/Action** (Product-Specific)
   - Event: `onboarding_first_action_started`
   - Guided creation of first resource/scan/project
   - Contextual help and tooltips
   - Event: `onboarding_first_action_completed`

4. **Notification Preferences**
   - Event: `onboarding_notifications_configured`
   - User sets email notification frequency
   - User enables/disables alert types
   - Event: `notification_preferences_saved`

### Onboarding Completion
**Event:** `onboarding_completed`
- All onboarding steps reviewed or skipped
- User can access full platform
- "Onboarding Complete" modal with next steps
- Links to documentation and support resources

## Email Verification Flow

### Verification Email Template Reference
- **Sender:** noreply@simplebeacon.com
- **Subject:** Confirm Your Email Address - SimpleBeacon
- **Content Type:** HTML with plain text fallback
- **Expiration:** Link valid for 24 hours
- **Resend Option:** Available for 72 hours after signup

### Verification Link Structure
```
https://app.simplebeacon.com/verify?token={VERIFICATION_TOKEN}&email={USER_EMAIL_ENCODED}
```
- Token includes: user_id, email_hash, timestamp, expiration
- Tokens stored in database with created_at and used_at timestamps

## Welcome Email Content

### Subject Line
"Welcome to SimpleBeacon! Get Started in 3 Steps"

### Email Body Structure
1. **Header:** Welcome message personalized with user's name
2. **Quick Start Section:** 
   - Link to onboarding checklist
   - Link to documentation
   - Link to video tutorials
3. **Feature Highlights:** 
   - 2-3 key features with icons
   - Brief descriptions
4. **Call-to-Action:** "Complete Your Setup" button
5. **Footer:** 
   - Support email
   - FAQ link
   - Unsubscribe option

## Activation Metric Definitions

### Key Conversion Metrics
- **Signup Started:** User initiates signup process
- **Email Verified:** Email verification completed successfully
- **Signup Completed:** Account fully created and activated
- **First Login:** User successfully authenticates after signup
- **Onboarding Initiated:** User accesses onboarding flow
- **Onboarding Completed:** User completes all onboarding steps
- **First Action Completed:** User completes first meaningful action (scan/project/etc.)

### Activation Milestones
- **Day 0 Activation:** Email verified and first login same day
- **Day 1 Activation:** Onboarding completed within 1 day
- **Day 7 Activation:** First meaningful action within 7 days
- **Day 30 Activation:** Sustained engagement (at least 3 logins in 30 days)

### Tracking Methods
- **Client-side:** JavaScript events tracked via analytics SDK
- **Server-side:** Backend events logged for critical transactions
- **Email:** Pixel tracking for welcome email opens
- **Funnel Analysis:** Track completion rates at each step

## Analytics Event Mapping

| Flow Step | Event Name | Event Type | Properties |
|-----------|-----------|-----------|-----------|
| Signup Page Load | signup_started | funnel | source, utm_params |
| Form Submission | signup_form_submitted | action | field_count, validation_errors |
| Email Verification Sent | email_verification_initiated | system | user_id, email_domain |
| Link Clicked | verification_link_clicked | action | user_id, click_timestamp |
| Email Verified | email_verified | funnel | user_id, verification_time_ms |
| Account Created | signup_completed | funnel | user_id, signup_source, account_type |
| Onboarding Started | onboarding_initiated | funnel | user_id, skipped_steps |
| Each Checklist Item | onboarding_step_completed | action | step_name, duration_ms |
| Onboarding Finished | onboarding_completed | funnel | user_id, total_duration_ms, items_completed |

## Data Privacy & Compliance

- All personally identifiable information (PII) in emails uses placeholders in templates
- Verification tokens expire after 24 hours
- Email addresses verified before account activation
- Compliance with GDPR, CCPA, and other privacy regulations
- Unsubscribe option available in all marketing emails
