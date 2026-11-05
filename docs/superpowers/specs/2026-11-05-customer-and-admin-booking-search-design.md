# Customer and Admin Booking Search Design

## Goal

Let administrators filter booking records by customer name or email, and let customers securely look up only their own bookings from the public booking page.

## Admin Search

The admin Bookings page gains a case-insensitive text input that filters the already-loaded records by trimmed customer name or email. It combines with the existing month filter and requires no API or database changes.

## Customer Lookup

The public booking page gains a “Find my booking” mode. A customer enters an email address, receives a one-time verification code, then submits that code to view bookings belonging only to the verified address.

The code-request endpoint always returns the same success response, whether or not the email has bookings. The verification endpoint returns only the booking fields needed by the customer: date, time, service, format, status, and payment status.

## Security and Data Flow

Verification codes are generated with cryptographic randomness, stored only as hashes, expire after 10 minutes, and are consumed on successful verification. Code requests are rate limited per email to prevent delivery abuse. The existing email-delivery configuration sends the code.

The local Node API and Cloudflare Pages Function implement matching request-code and verify-code endpoints. A database migration creates the ephemeral verification-code store. Records are cleaned up after use or expiry.

## Customer Experience

The lookup mode has an email step, a code step, and a results view. It shows generic request feedback, explicit invalid/expired-code errors, an accessible way to return to the booking form, and an empty state for verified emails with no bookings.

## Validation

Add focused coverage for code expiry, one-time consumption, email isolation, and rate limiting. Verify admin filtering for name, email, combined month/search criteria, and no-result behavior. Run the production build and exercise the customer lookup endpoints with a temporary local record.
