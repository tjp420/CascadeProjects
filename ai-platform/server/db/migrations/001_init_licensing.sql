-- SimpleBeacon License & Billing Schema v1
-- Initial migration for corporate client tracking and token history

CREATE TABLE IF NOT EXISTS corporate_clients (
    company_id VARCHAR(255) PRIMARY KEY,
    customer_email VARCHAR(255) NOT NULL,
    current_tier VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS license_token_history (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR(255) REFERENCES corporate_clients(company_id),
    license_token TEXT NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    customer_email VARCHAR(255) NOT NULL,
    company_id VARCHAR(255),
    tier_selected VARCHAR(50),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
