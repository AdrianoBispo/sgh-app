# Security Spec (ABAC and Validation Blueprints)

## Data Invariants
- All collections (`patients`, `doctors`, `appointments`, `inventory`, `reportLogs`) require the user to be signed in and have a verified email.
- Data structures must strictly adhere to the defined schemas in `firebase-blueprint.json`.
- Strict typing and string/array sizing must be enforced.

## "Dirty Dozen" Payloads
1. Unauthorized user trying to write to `patients`.
2. Missing email_verified trying to read `doctors`.
3. Creating a patient with missing required field `cpf`.
4. Creating a patient with extra ghost field `isAdmin: true`.
5. Creating an appointment with a negative size or wrong type for `type`.
6. Updating a doctor to remove a required field.
7. Updating an inventory item with negative `minQuantity`.
8. Updating a patient with invalid status (not active/inactive).
9. Path ID poisoning on `appointments/{invalidID}` (size > 128).
10. Creating a report log with an unverified user.
11. PII Blanket Test: Fetching a single patient without auth (must fail).
12. Creating a doctor with oversized string in `name`.
