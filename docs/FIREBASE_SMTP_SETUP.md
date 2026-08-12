# Firebase Admin and SMTP OTP setup

## Firebase Admin

The backend uses Firebase Admin to verify Firebase ID tokens and send FCM push notifications. The mobile Firebase configuration files (`google-services.json` or `GoogleService-Info.plist`) are not service-account keys and cannot be used by this backend.

### Create the backend credential

1. Open **Firebase Console → Project settings → Service accounts**.
2. Select **Generate new private key** and download the JSON file.
3. Never commit this file. Files under `firebase/*.json` are ignored by Git.

### Local configuration

Save the downloaded file as `firebase/service-account.json`, then set:

```env
FIREBASE_CONFIG_PATH="firebase/service-account.json"
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
FIREBASE_SERVICE_ACCOUNT_JSON=""
```

### Render configuration

Use one of these methods, not both.

Method A — environment variables:

```env
FIREBASE_CONFIG_PATH=""
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The backend converts literal `\n` sequences in `FIREBASE_PRIVATE_KEY` to real line breaks.

Method B — Render Secret File:

1. Create a Render Secret File named `firebase-service-account.json` containing the complete downloaded JSON.
2. Set `FIREBASE_CONFIG_PATH=/etc/secrets/firebase-service-account.json`.

The warning `service account file was not found at /etc/secrets/...` means the environment variable exists but the Render Secret File does not. Create the file or clear `FIREBASE_CONFIG_PATH` and use Method A.

After restarting, the expected log is:

```text
Firebase Admin initialized successfully
```

For phone authentication, also enable the **Phone** provider under **Firebase Authentication → Sign-in method** and configure the Android/iOS app in Firebase Console.

## SMTP email OTP

The registration OTP, resend OTP, welcome email, and password-reset email now use Nodemailer SMTP. Resend is no longer used.

### Gmail setup

1. Enable 2-Step Verification on the sending Google account.
2. Open **Google Account → Security → App passwords**.
3. Create an App Password for Mail and copy the generated 16-character password.
4. Configure `.env` or the same variables in Render:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-account@gmail.com"
SMTP_PASS="your-16-character-app-password"
SMTP_FROM="Lost & Found <your-account@gmail.com>"
SKIP_EMAIL_VERIFICATION=false
```

Port `587` uses STARTTLS and `SMTP_SECURE=false`. If your SMTP provider requires port `465`, use `SMTP_SECURE=true`.

Verify credentials before starting the API:

```bash
npm run smtp:verify
```

Expected result:

```text
SMTP connection verified successfully
```

### OTP API flow

Registering sends the OTP to the submitted `email`. The existing mobile contract is preserved: verification and resend still identify the pending registration with `phoneNumber`.

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123",
  "displayName": "Test User",
  "phoneNumber": "0900000000"
}
```

```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "0900000000",
  "code": "123456"
}
```

```http
POST /api/auth/resend-otp
Content-Type: application/json

{
  "phoneNumber": "0900000000"
}
```

Resend requests have a 60-second cooldown. Gmail is suitable for development and small-volume use; use a dedicated SMTP provider for production volume.
