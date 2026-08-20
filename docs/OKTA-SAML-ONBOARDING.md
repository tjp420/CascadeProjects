# Okta SAML 2.0 Onboarding Manual

**SimpleBeacon Enterprise Single Sign-On Integration Guide**

|                       |                                                  |
| --------------------- | ------------------------------------------------ |
| **Document Version**  | 1.0                                              |
| **Audience**          | Enterprise IT Administrators, Identity Engineers |
| **Estimated Time**    | 15 minutes                                       |
| **Protocol**          | SAML 2.0                                         |
| **Identity Provider** | Okta                                             |
| **Service Provider**  | SimpleBeacon                                     |

---

## Table of Contents

1. [Overview & Prerequisites](#1-overview--prerequisites)
2. [Step 1: Create SAML Application in Okta](#2-step-1-create-saml-application-in-okta)
3. [Step 2: Configure SAML Settings in Okta](#3-step-2-configure-saml-settings-in-okta)
4. [Step 3: Download Okta Metadata](#4-step-3-download-okta-metadata)
5. [Step 4: Register SSO Config in SimpleBeacon Admin Dashboard](#5-step-4-register-sso-config-in-simplebeacon-admin-dashboard)
6. [Step 5: Test the Integration](#6-step-5-test-the-integration)
7. [Step 6: Assign Users in Okta](#7-step-6-assign-users-in-okta)
8. [Step 7: Enable and Go Live](#8-step-7-enable-and-go-live)
9. [API Alternative (for automation)](#9-api-alternative-for-automation)
10. [Troubleshooting](#10-troubleshooting)
11. [Security Notes](#11-security-notes)
12. [Quick Reference](#12-quick-reference)

---

## 1. Overview & Prerequisites

This guide walks an Okta administrator through configuring Okta as the Identity Provider (IdP) and registering SimpleBeacon as the Service Provider (SP) for SAML 2.0 single sign-on. After completing this guide, users in your organization will be able to authenticate to SimpleBeacon using their Okta credentials.

### Prerequisites

Before you begin, ensure you have the following:

- **Okta Administrator access** with permission to create and configure SAML application integrations.
- **SimpleBeacon Administrator access** with access to the Admin Dashboard and SSO Configuration panel.
- **Company email domain** (e.g., `acme.com`) used for auto-routing users to your Okta tenant.
- **SimpleBeacon application base URL** (e.g., `https://app.simplebeacon.ai`) — referred to as `{APP_BASE_URL}` throughout this guide.
- **Network connectivity** from end-user browsers to both Okta and the SimpleBeacon application base URL.

### Architecture

The diagram below illustrates the SAML 2.0 authentication flow between Okta (IdP) and SimpleBeacon (SP):

```
+-------------------+        (1) User navigates to SimpleBeacon
|                   |            /api/sso/saml/login?providerId=okta
|   End User        |..............................................
|   Browser         |                                            |
|                   |                                            v
+-------------------+                              +-----------------------------+
                                                   |                             |
                                                   |   SimpleBeacon (SP)         |
                                                   |                             |
                                                   |  /api/sso/saml/login        |
                                                   |  /api/sso/saml/acs          |
                                                   |  /api/sso/saml/metadata     |
                                                   |                             |
+-------------------+                              +-----------------------------+
|                   |                                            ^  |
|   Okta (IdP)      |             (2) SAML AuthnRequest           |  |
|                   |-------------------------------------------->|  |
|                   |                                            |  |
|                   |             (3) User authenticates          |  |
|                   |             (Okta login page)               |  |
|                   |                                            |  |
|                   |             (4) SAML Response (signed)      |  |
|                   |<--------------------------------------------|  |
|                   |                                            |  |
|                   |             (5) POST SAML Response          |  |
|                   |             to ACS URL                      |  |
|                   |-------------------------------------------->|  |
|                   |                                            v  |
+-------------------+                              +-----------------------------+
                                                   |                             |
                                                   |  (6) Validate signature      |
                                                   |      using IdP certificate   |
                                                   |                             |
                                                   |  (7) Establish session       |
                                                   |      redirect to dashboard   |
                                                   |                             |
                                                   +-----------------------------+
```

### Flow Summary

1. The user navigates to the SimpleBeacon SAML login endpoint.
2. SimpleBeacon generates a SAML AuthnRequest and redirects the browser to Okta.
3. The user authenticates at Okta (existing session is used if available).
4. Okta generates a signed SAML Response.
5. Okta POSTs the SAML Response to the SimpleBeacon ACS URL.
6. SimpleBeacon validates the response signature using the Okta X.509 certificate registered in the SSO config.
7. On success, SimpleBeacon establishes a session and redirects the user to the dashboard.

---

## 2. Step 1: Create SAML Application in Okta

1. Log in to the **Okta Admin Console** at `https://<your-org>.okta.com`.
2. In the left navigation, go to **Applications** > **Applications**.
3. Click **Create App Integration**.
4. In the "Create a new app integration" dialog, select **SAML 2.0**.
5. Click **Next**.
6. Under **General Settings**:
   - **App name**: `SimpleBeacon`
   - **App logo**: Upload the SimpleBeacon logo (contact your SimpleBeacon account team for the official logo asset, or use a square PNG, 256x256 px recommended).
   - **App visibility**: Configure as desired (we recommend showing the app icon to users).
7. Click **Next** to proceed to the SAML configuration screen (covered in Step 2).

> **Note:** Do not select OIDC or WS-Federation. SimpleBeacon uses the SAML 2.0 protocol for this integration.

---

## 3. Step 2: Configure SAML Settings in Okta

On the **Configure SAML** screen, fill in the following fields:

| Okta Field                      | Value                             | Notes                                                                                                                                                                          |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Single sign on URL**          | `{APP_BASE_URL}/api/sso/saml/acs` | Replace `{APP_BASE_URL}` with your SimpleBeacon base URL. This is the Assertion Consumer Service (ACS) endpoint.                                                               |
| **Audience URI (SP Entity ID)** | `https://simplebeacon.ai/sp`      | The Service Provider entity ID. This value must exactly match the `samlIssuer` field entered in SimpleBeacon. A custom value is supported but must be identical on both sides. |
| **Default RelayState**          | _(leave blank)_                   | SimpleBeacon manages relay state internally.                                                                                                                                   |
| **Name ID format**              | `EmailAddress`                    | The NameID will be used to identify the user.                                                                                                                                  |
| **Application username**        | `Email`                           | Maps the Okta username to the user's email address.                                                                                                                            |
| **Response**                    | `Signed`                          | Recommended. Ensures the SAML response is signed.                                                                                                                              |
| **Assertion Signature**         | `Signed`                          | Recommended for additional integrity protection.                                                                                                                               |
| **Signature Algorithm**         | `RSA-SHA256`                      | Default and recommended.                                                                                                                                                       |
| **Digest Algorithm**            | `SHA256`                          | Default and recommended.                                                                                                                                                       |

### Attribute Statements (Optional but Recommended)

Add the following attribute statements to pass user profile data to SimpleBeacon:

| Name        | Name format | Value            |
| ----------- | ----------- | ---------------- |
| `email`     | Unspecified | `user.email`     |
| `firstName` | Unspecified | `user.firstName` |
| `lastName`  | Unspecified | `user.lastName`  |

Example configuration:

```
Attribute Statements
  Name: email        Name format: Unspecified   Value: user.email
  Name: firstName    Name format: Unspecified   Value: user.firstName
  Name: lastName     Name format: Unspecified   Value: user.lastName
```

> **Screenshot placeholder:** _[Insert screenshot of Okta SAML configuration screen showing the completed fields above.]_

Click **Next** to proceed to the feedback screen, then click **Finish**.

---

## 4. Step 3: Download Okta Metadata

After creating the application, Okta displays the application's **Sign On** settings, including the Identity Provider metadata required by SimpleBeacon.

### 4.1 Locate the Identity Provider Metadata

1. In Okta, navigate to **Applications** > **Applications** > **SimpleBeacon**.
2. Go to the **Sign On** tab.
3. Scroll to the **SAML 2.0** section.
4. Click **View Setup Instructions** (or locate the "Identity Provider metadata" details directly on the page).

### 4.2 Extract the IdP SSO URL (entryPoint)

From the setup instructions or metadata, locate the **Identity Provider Single Sign-On URL**. This is the value you will enter as `samlEntryPoint` in SimpleBeacon. It typically looks like:

```
https://acme.okta.com/app/simplebeacon/acmeoktasimplebeacon/sso/saml
```

### 4.3 Download the X.509 Certificate (PEM format)

In the same setup instructions view, locate the **Identity Provider Certificate** section. Download or copy the certificate in **PEM format**. The certificate block should look like:

```
-----BEGIN CERTIFICATE-----
MIIDpDCCAoygAwIBAgIGAXLd1n5/v+8WMA0GCSqGSIb3DQEBCwUAMIGSMQswCQYD
VQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5j
aXNjbzENMAsGA1UECgwET2t0YTEUMBIGA1UEAwwLb2t0YS5jb20gQ0ExHDAaBgkq
...several lines of base64-encoded certificate data...
hkiG9w0BAQsFAAOCAQEAQXm5h3pFkQ8Xe5v7n9k2J4o1z3Vq8W6m5Y8n9p0L3xK
-----END CERTIFICATE-----
```

> **Important:** The certificate must include the `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` delimiters and be in PEM (base64) format, not DER (binary) format. See [Troubleshooting](#10-troubleshooting) if you encounter format issues.

### 4.4 (Alternative) Use the Metadata URL

Okta also exposes a metadata URL of the form:

```
https://acme.okta.com/app/exke0a1b2c3d4e5f6/sso/saml/metadata
```

You may fetch this URL to obtain both the IdP SSO URL and the X.509 certificate in a single XML document. The values you need are:

- `SingleSignOnService` `Location` attribute -> maps to `samlEntryPoint`
- `X509Certificate` element under `IDPSSODescriptor` `KeyDescriptor use="signing"` -> maps to `samlCert` (wrap with `-----BEGIN CERTIFICATE-----` / `-----END CERTIFICATE-----`)

---

## 5. Step 4: Register SSO Config in SimpleBeacon Admin Dashboard

Now that you have the Okta IdP SSO URL and X.509 certificate, register the SSO configuration in SimpleBeacon.

1. Log in to the **SimpleBeacon Admin Dashboard**.
2. Navigate to **Admin** > **SSO Configuration**.
3. Click **Add Provider**.
4. Fill in the form fields as follows:

| SimpleBeacon Field                      | Value                                     | Description                                                                                          |
| --------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Display Name** (`displayName`)        | `Acme Okta`                               | Human-readable label shown in the admin dashboard.                                                   |
| **Method** (`method`)                   | `saml`                                    | Select the SAML radio option.                                                                        |
| **Provider Type** (`providerType`)      | `okta`                                    | Select from the dropdown.                                                                            |
| **Domain** (`domain`)                   | `acme.com`                                | The email domain used for auto-routing. Users with `@acme.com` addresses will be redirected to Okta. |
| **SAML Entry Point** (`samlEntryPoint`) | _(paste IdP SSO URL from Okta)_           | The Okta Single Sign-On URL obtained in Step 3.2.                                                    |
| **SAML Certificate** (`samlCert`)       | _(paste X.509 PEM certificate from Okta)_ | The full PEM block including BEGIN/END delimiters from Step 3.3.                                     |
| **SAML Issuer** (`samlIssuer`)          | `https://simplebeacon.ai/sp`              | The SP Entity ID. **Must exactly match** the Audience URI configured in Okta (Step 2).               |

5. Click **Save** to persist the configuration.

### Field Mapping Reference (Okta to SimpleBeacon)

| Okta Field                           | SimpleBeacon Form Field | SimpleBeacon Schema Field |
| ------------------------------------ | ----------------------- | ------------------------- |
| App name                             | Display Name            | `displayName`             |
| (n/a)                                | Method                  | `method`                  |
| (n/a)                                | Provider Type           | `providerType`            |
| (n/a)                                | Domain                  | `domain`                  |
| Identity Provider Single Sign-On URL | SAML Entry Point        | `saml.entryPoint`         |
| Identity Provider Certificate (PEM)  | SAML Certificate        | `saml.cert`               |
| Audience URI (SP Entity ID)          | SAML Issuer             | `saml.issuer`             |

> **Note:** The certificate you paste is encrypted at rest using AES-256-GCM before being stored. See [Security Notes](#11-security-notes) for details.

---

## 6. Step 5: Test the Integration

Before enabling the integration for all users, verify that the configuration is correct.

### 6.1 Test via Admin Dashboard

1. In the SimpleBeacon Admin Dashboard, locate the SSO configuration you just created.
2. Click the **Test** button. This calls the connectivity test endpoint:

   ```
   GET /api/enterprise/sso/test/:providerId
   ```

3. Review the response for any validation errors (e.g., unreachable entry point, malformed certificate).

### 6.2 Manual End-to-End Test

1. Open a new browser window (preferably incognito/private to avoid session reuse).
2. Navigate to the SAML login endpoint:

   ```
   {APP_BASE_URL}/api/sso/saml/login?providerId=okta
   ```

3. Verify that you are redirected to the **Okta login page**.
4. Authenticate with an Okta user account that has been assigned the SimpleBeacon application.
5. Verify that you are redirected back to the **SimpleBeacon dashboard** after authentication.

### 6.3 Verify SP Metadata (Optional)

You can inspect the SimpleBeacon SP metadata to confirm the registered entity ID and ACS URL:

```
GET {APP_BASE_URL}/api/sso/saml/metadata/okta
```

The returned XML should contain the `entityID` and `AssertionConsumerService` `Location` matching your configuration.

### 6.4 Common Test Issues

| Symptom                         | Likely Cause                                                     | Resolution                                                              |
| ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Redirect to Okta fails          | `samlEntryPoint` URL is incorrect or unreachable                 | Verify the URL copied from Okta. Ensure network access to Okta.         |
| "Invalid signature" after login | `samlCert` does not match the Okta signing certificate           | Re-download the certificate from Okta and paste the full PEM block.     |
| "Entity ID mismatch"            | `samlIssuer` differs from Okta Audience URI                      | Ensure both sides use the exact same value, including trailing slashes. |
| ACS URL not reached             | ACS URL in Okta does not match `{APP_BASE_URL}/api/sso/saml/acs` | Correct the Single sign on URL in Okta.                                 |

---

## 7. Step 6: Assign Users in Okta

The SimpleBeacon application must be assigned to users in Okta before they can authenticate.

1. In Okta, navigate to **Applications** > **Applications** > **SimpleBeacon**.
2. Go to the **Assignments** tab.
3. Click **Assign** and choose either **Assign to People** or **Assign to Groups**.
4. We recommend creating a dedicated group named **SimpleBeacon Users** and assigning the application to that group.
5. Add the appropriate users to the **SimpleBeacon Users** group.

> **Best Practice:** Use group-based assignments for easier management. When onboarding new employees, simply add them to the group rather than assigning the application individually.

---

## 8. Step 7: Enable and Go Live

Once testing is successful and users are assigned, enable the integration.

1. In the SimpleBeacon Admin Dashboard, return to the SSO configuration for your Okta provider.
2. Toggle the **Enabled** switch to `true` (or set `enabled: true` via the API).
3. Save the configuration.

### Verify Email Domain Auto-Routing

With the provider enabled and the `domain` field set (e.g., `acme.com`), users who attempt to sign in with an `@acme.com` email address will be automatically redirected to Okta for authentication.

To verify:

1. Sign out of SimpleBeacon.
2. Initiate a login using an `@acme.com` email address.
3. Confirm that the browser is redirected to the Okta login page without manual provider selection.

> **Note:** If multiple SSO providers are configured, the email domain is used to route users to the correct IdP. Ensure each provider has a unique domain.

---

## 9. API Alternative (for automation)

For environments that prefer infrastructure-as-code or scripted onboarding, the SSO configuration can be created and managed via the REST API. All requests require an authenticated admin session (bearer token).

### 9.1 Create an SSO Config

```bash
curl -X POST "{APP_BASE_URL}/api/enterprise/sso/configs" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "okta",
    "orgId": "<your-org-id>",
    "displayName": "Acme Okta",
    "method": "saml",
    "providerType": "okta",
    "domain": "acme.com",
    "enabled": false,
    "saml": {
      "entryPoint": "https://acme.okta.com/app/simplebeacon/acmeoktasimplebeacon/sso/saml",
      "cert": "-----BEGIN CERTIFICATE-----\nMIIDpDCCAoygAwIBAgIGAXLd...\n-----END CERTIFICATE-----",
      "issuer": "https://simplebeacon.ai/sp"
    }
  }'
```

> **Note:** Newline characters inside the `cert` field must be escaped as `\n` in the JSON payload. The server will re-encode the certificate at rest using AES-256-GCM.

### 9.2 Update an Existing Config

```bash
curl -X PUT "{APP_BASE_URL}/api/enterprise/sso/configs/okta" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "saml": {
      "entryPoint": "https://acme.okta.com/app/simplebeacon/acmeoktasimplebeacon/sso/saml",
      "cert": "-----BEGIN CERTIFICATE-----\nMIIDpDCCAoygAwIBAgIGAXLd...\n-----END CERTIFICATE-----",
      "issuer": "https://simplebeacon.ai/sp"
    }
  }'
```

### 9.3 List All SSO Configs

```bash
curl -X GET "{APP_BASE_URL}/api/enterprise/sso/configs" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 9.4 Test Connectivity

```bash
curl -X GET "{APP_BASE_URL}/api/enterprise/sso/test/okta" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 9.5 Initiate SAML Login

```bash
curl -X GET "{APP_BASE_URL}/api/sso/saml/login?providerId=okta"
```

### 9.6 Retrieve SP Metadata

```bash
curl -X GET "{APP_BASE_URL}/api/sso/saml/metadata/okta"
```

---

## 10. Troubleshooting

### Certificate Format Issues (PEM vs DER)

**Symptom:** Signature validation fails with a certificate parsing error.

**Cause:** The certificate was provided in DER (binary) format instead of PEM (base64) format.

**Resolution:** Convert the certificate to PEM format using OpenSSL:

```bash
openssl x509 -inform DER -in okta_cert.der -outform PEM -out okta_cert.pem
```

Then paste the contents of `okta_cert.pem` (including the `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` lines) into the `samlCert` field.

### Entity ID Mismatch

**Symptom:** Okta returns an error indicating the audience restriction does not match, or SimpleBeacon rejects the assertion.

**Cause:** The `samlIssuer` value in SimpleBeacon does not exactly match the **Audience URI (SP Entity ID)** configured in Okta.

**Resolution:** Ensure both values are identical, character-for-character. Common pitfalls include trailing slashes, `http` vs `https`, and case sensitivity.

### ACS URL Not Reachable

**Symptom:** After authenticating at Okta, the browser does not return to SimpleBeacon, or an error is displayed.

**Cause:** The ACS URL configured in Okta is incorrect, or the SimpleBeacon application is not reachable from the user's browser or network.

**Resolution:**

1. Confirm the **Single sign on URL** in Okta is set to `{APP_BASE_URL}/api/sso/saml/acs`.
2. Verify that `{APP_BASE_URL}` is correct and resolvable from the user's network.
3. Check that no firewall, proxy, or WAF is blocking POST requests to the ACS endpoint.
4. Ensure the SimpleBeacon application is running and healthy.

### Clock Skew

**Symptom:** Intermittent authentication failures, particularly for users in different time zones.

**Cause:** The system clocks on the Okta IdP and SimpleBeacon SP are out of sync, causing SAML assertions to be rejected due to `NotBefore` / `NotOnOrAfter` condition violations.

**Resolution:** Ensure both Okta and the SimpleBeacon server are synchronized to a reliable NTP source. If the issue persists, contact SimpleBeacon support to adjust the configured clock skew tolerance.

### Certificate Expiration

**Symptom:** Authentication suddenly stops working after a period of successful use.

**Cause:** The Okta signing certificate has expired or been rotated, and the certificate registered in SimpleBeacon is now stale.

**Resolution:**

1. In Okta, navigate to **Applications** > **SimpleBeacon** > **Sign On**.
2. Check the certificate expiration date. Okta typically rotates certificates annually.
3. Download the new certificate in PEM format.
4. In SimpleBeacon, update the `samlCert` field with the new certificate.
5. Test the integration again before re-enabling.

> **Recommendation:** Subscribe to Okta certificate rotation notifications and establish a recurring process to update the certificate in SimpleBeacon before expiration.

### Additional Issues

| Issue                       | Possible Cause                                            | Resolution                                                                         |
| --------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `providerId` not found      | The `providerId` in the URL does not match a saved config | Verify the provider ID in the admin dashboard.                                     |
| User not redirected to Okta | Provider is disabled (`enabled: false`)                   | Enable the provider in the admin dashboard.                                        |
| Auto-routing not working    | `domain` field is missing or incorrect                    | Ensure the domain matches the user's email domain (without `@`).                   |
| "Method not allowed" on ACS | ACS endpoint received a GET instead of POST               | The ACS endpoint requires POST. This is handled by the browser redirect from Okta. |

---

## 11. Security Notes

SimpleBeacon implements several security controls to protect SSO configuration data and authentication flows.

### Encryption at Rest

- All SAML certificates and OIDC client secrets are encrypted at rest using **AES-256-GCM** authenticated encryption.
- The encryption key is resolved from the following sources, in priority order:
  1. `SSO_CONFIG_ENCRYPTION_KEY` environment variable
  2. `JWT_SECRET` environment variable
  3. A development fallback secret (development environments only)
- For production deployments, always set `SSO_CONFIG_ENCRYPTION_KEY` to a strong, randomly generated value and manage it via your secrets manager.

### Secret Masking in API Responses

- Certificate and secret values are masked in API responses. Only the first 4 and last 4 characters are displayed (e.g., `-----...-----` or `ABCD...WXYZ`).
- Full secret values are never returned by list or get endpoints.

### Open Redirect Protection

- All redirect URLs (including RelayState and post-authentication redirects) are validated against an allowlist to prevent open redirect attacks.
- Redirects to untrusted origins are rejected.

### Audit Logging

- All SSO configuration changes (create, update, delete, enable/disable) are recorded in the audit log.
- Each entry includes the actor, timestamp, provider ID, and the fields modified.
- Review audit logs periodically to detect unauthorized configuration changes.

### Additional Recommendations

- Use a dedicated Okta admin account for managing the SimpleBeacon integration.
- Restrict the SimpleBeacon application assignment to the minimum necessary user population.
- Rotate the `SSO_CONFIG_ENCRYPTION_KEY` periodically as part of your key management policy. Note that rotating the key requires re-encrypting existing configs.
- Monitor Okta system logs for authentication events related to the SimpleBeacon application.

---

## 12. Quick Reference

### Endpoint Summary

| Purpose              | Method | Endpoint                                  |
| -------------------- | ------ | ----------------------------------------- |
| Create SSO config    | `POST` | `/api/enterprise/sso/configs`             |
| Update SSO config    | `PUT`  | `/api/enterprise/sso/configs/:providerId` |
| List all SSO configs | `GET`  | `/api/enterprise/sso/configs`             |
| Test connectivity    | `GET`  | `/api/enterprise/sso/test/:providerId`    |
| Initiate SAML login  | `GET`  | `/api/sso/saml/login?providerId=okta`     |
| SAML ACS endpoint    | `POST` | `/api/sso/saml/acs`                       |
| SP metadata          | `GET`  | `/api/sso/saml/metadata/:providerId`      |

### Okta Configuration Summary

| Okta Field                     | Value                             |
| ------------------------------ | --------------------------------- |
| App name                       | `SimpleBeacon`                    |
| Sign-in method                 | SAML 2.0                          |
| Single sign on URL             | `{APP_BASE_URL}/api/sso/saml/acs` |
| Audience URI (SP Entity ID)    | `https://simplebeacon.ai/sp`      |
| Default RelayState             | _(blank)_                         |
| Name ID format                 | `EmailAddress`                    |
| Application username           | `Email`                           |
| Response / Assertion Signature | `Signed`                          |
| Signature Algorithm            | `RSA-SHA256`                      |

### SimpleBeacon Configuration Summary

| Field            | Form Field       | Schema Path       | Example Value                            |
| ---------------- | ---------------- | ----------------- | ---------------------------------------- |
| Display Name     | Display Name     | `displayName`     | `Acme Okta`                              |
| Method           | Method           | `method`          | `saml`                                   |
| Provider Type    | Provider Type    | `providerType`    | `okta`                                   |
| Domain           | Domain           | `domain`          | `acme.com`                               |
| SAML Entry Point | SAML Entry Point | `saml.entryPoint` | `https://acme.okta.com/app/.../sso/saml` |
| SAML Certificate | SAML Certificate | `saml.cert`       | `-----BEGIN CERTIFICATE-----...`         |
| SAML Issuer      | SAML Issuer      | `saml.issuer`     | `https://simplebeacon.ai/sp`             |
| Enabled          | Enabled toggle   | `enabled`         | `true`                                   |

### Attribute Statement Summary

| Name        | Value            |
| ----------- | ---------------- |
| `email`     | `user.email`     |
| `firstName` | `user.firstName` |
| `lastName`  | `user.lastName`  |

---

_End of document. For additional support, contact your SimpleBeacon account team or refer to the SimpleBeacon administrator documentation._
