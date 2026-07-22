# Security Specification for Hyper-Local Logistics Portal

## 1. Data Invariants

1. **Profiles Invariant**: A user's profile document name MUST match their normalized authenticated email address. Only the profile's owner can read or write their own profile document.
2. **Dispatches Invariant**: Dispatches can only be created, read, or modified by the user whose email is referenced in the dispatch's `userEmail` field.
3. **Logs Invariant**: System tracking and security audit logs can only be read, created, or modified by the user whose email is referenced in the log's `userEmail` field.

---

## 2. The "Dirty Dozen" Payloads

Here are 12 specific payloads designed to attempt to violate system security boundary laws:

1. **Profile Spoofing**: Attempting to write a profile document under `profiles/victim@example.com` while authenticated as `hacker@example.com`.
2. **Profile Ghost Field Injection**: Attempting to inject unapproved properties (e.g., `isAdmin: true` or `isVerified: true`) into the profile payload.
3. **ID Poisoning in Profiles**: Attempting to write a profile using an excessively long string with junk characters as the document ID.
4. **Unauthenticated Read**: Attempting to query the `profiles` collection without an active Firebase Auth session.
5. **Dispatch Hijacking**: Attempting to write a dispatch document with a payload where `userEmail` is `victim@example.com` while authenticated as `hacker@example.com`.
6. **Dispatch Cross-Read**: Attempting to read dispatch records belonging to another user.
7. **Dispatch Status Shortcut**: Attempting to arbitrarily transition the progress or status of a dispatch to an invalid terminal state without correct coordinates.
8. **Log Impersonation**: Attempting to write log entries under `logs/log-id` with `userEmail: 'victim@example.com'` while signed in as `hacker@example.com`.
9. **Log Cross-Read**: Attempting to list or read log messages belonging to another user.
10. **Denial of Wallet Attack**: Sending massive payloads (e.g. 1MB strings) as a field value to exhaust project resource metrics.
11. **Anonymized/Unverified Profile Writes**: Attempting to write data without an authentic email provider in the request token.
12. **Blanket Query Scraping**: Attempting to retrieve all dispatches by sending a list query without a specific `userEmail` filter.

---

## 3. Security Rules Draft

The complete `firestore.rules` containing global primitive helpers and validation checks:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Global safety net
    match /{document=**} {
      allow read, write: if false;
    }

    // Global Helpers
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(email) {
      return isSignedIn() && request.auth.token.email == email;
    }

    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-\\+\\.\\@]+$');
    }

    function isValidProfile(data) {
      return data.name is string && data.name.size() <= 100
          && data.phone is string && data.phone.size() <= 30
          && data.email is string && data.email.size() <= 100
          && data.address is string && data.address.size() <= 500
          && data.dispatchZone is string && data.dispatchZone.size() <= 100;
    }

    function isValidDispatch(data) {
      return data.id is string && data.id.size() <= 100
          && data.category is string && data.category.size() <= 100
          && data.pickupAddress is string && data.pickupAddress.size() <= 500
          && data.dropAddress is string && data.dropAddress.size() <= 500
          && data.priority is string && data.priority.size() <= 100
          && data.status is string && data.status.size() <= 100
          && data.userEmail is string && data.userEmail.size() <= 100;
    }

    function isValidLog(data) {
      return data.id is string && data.id.size() <= 100
          && data.userEmail is string && data.userEmail.size() <= 100
          && data.timestamp is string && data.timestamp.size() <= 100
          && data.message is string && data.message.size() <= 1000
          && data.type is string && data.type.size() <= 100;
    }

    // Profiles Collection rules
    match /profiles/{email} {
      allow get: if isSignedIn() && (request.auth.token.email == email || resource == null);
      allow list: if isSignedIn() && request.auth.token.email == email;
      allow create, update: if isSignedIn() && request.auth.token.email == email && isValidId(email) && isValidProfile(request.resource.data);
      allow delete: if false;
    }

    // Dispatches Collection rules
    match /dispatches/{dispatchId} {
      allow get: if isSignedIn() && resource.data.userEmail == request.auth.token.email;
      allow list: if isSignedIn() && resource.data.userEmail == request.auth.token.email;
      allow create, update: if isSignedIn() && request.resource.data.userEmail == request.auth.token.email && isValidId(dispatchId) && isValidDispatch(request.resource.data);
      allow delete: if isSignedIn() && resource.data.userEmail == request.auth.token.email;
    }

    // Logs Collection rules
    match /logs/{logId} {
      allow get: if isSignedIn() && resource.data.userEmail == request.auth.token.email;
      allow list: if isSignedIn() && resource.data.userEmail == request.auth.token.email;
      allow create, update: if isSignedIn() && request.resource.data.userEmail == request.auth.token.email && isValidId(logId) && isValidLog(request.resource.data);
      allow delete: if isSignedIn() && resource.data.userEmail == request.auth.token.email;
    }
  }
}
```
