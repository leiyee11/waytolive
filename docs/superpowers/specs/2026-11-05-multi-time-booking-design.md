# Multi-Time Booking Design

## Goal

Allow customers to choose multiple available date/time slots in one booking submission, then let an administrator approve or reject every resulting booking independently.

## Customer Experience

The calendar continues to provide one active date for browsing its available times. Selecting a time toggles that exact date/time slot into a booking-selection collection; selecting it again removes it. Selections remain while the customer browses other dates.

A details panel on the right of the booking form lists every selected date and time. Each entry has a cancel icon that removes only that selection. The submit button remains disabled until at least one slot is selected.

## Submission and Data Flow

The client submits the shared customer and session details with a `slots` array of `{ date, time }` objects. The availability API accepts this batch, verifies every selected slot is valid, enabled, and conflict-free for the requested service, then creates all bookings with `pending` status as one atomic operation.

The response returns the independent created booking records. If any slot is no longer available, the API rejects the whole request and creates none, allowing the customer to adjust the selection and resubmit.

## Admin Experience

Every requested slot is stored as a normal independent pending booking. The existing admin booking controls approve or reject each record separately; no parent request or batch-level action is introduced.

## Validation and Accessibility

The client prevents duplicate selections, clears selections that become unavailable after an availability refresh, and presents the selected-slot summary as an accessible list. Each removal control has an explicit accessible label containing its selected date and time.

Both the local Node API and Cloudflare Pages Function validate the `slots` payload, enforce a non-empty bounded list, prevent duplicate date/time pairs, and re-check conflicts transactionally before inserting. The existing one-slot booking flow remains supported for compatibility.

## Testing

Add focused coverage for client selection toggling and for API batch validation: successful atomic creation, duplicate-slot rejection, unavailable-slot rejection without partial inserts, and individually manageable pending records. Build the production site and exercise the local booking endpoint with a multi-slot request.
