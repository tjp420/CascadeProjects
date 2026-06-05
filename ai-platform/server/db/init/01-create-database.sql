-- Simplebeacon v1-Internal Database Initialization
-- This script creates the basic database schema for Phase 2 features

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    level VARCHAR(10) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    user_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path TEXT,
    response_status INTEGER,
    duration_ms INTEGER,
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON audit_logs(level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Create user sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB
);

-- Create indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '[]',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    metadata JSONB
);

-- Create indexes for api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- Create scan results table
CREATE TABLE IF NOT EXISTS scan_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_path TEXT NOT NULL,
    scan_profile VARCHAR(50) DEFAULT 'eu-ai-act',
    scan_version VARCHAR(20) DEFAULT '1.0.0',
    scan_status VARCHAR(20) DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    scan_duration_ms INTEGER,
    total_files INTEGER DEFAULT 0,
    issues_found INTEGER DEFAULT 0,
    blocking_issues INTEGER DEFAULT 0,
    warning_issues INTEGER DEFAULT 0,
    gate_status VARCHAR(20) DEFAULT 'pending',
    quality_score INTEGER,
    scan_report JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for scan_results
CREATE INDEX IF NOT EXISTS idx_scan_results_project_path ON scan_results(project_path);
CREATE INDEX IF NOT EXISTS idx_scan_results_scan_status ON scan_results(scan_status);
CREATE INDEX IF NOT EXISTS idx_scan_results_started_at ON scan_results(started_at);
CREATE INDEX IF NOT EXISTS idx_scan_results_gate_status ON scan_results(gate_status);

-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) UNIQUE NOT NULL,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    request_count INTEGER DEFAULT 0,
    window_duration_seconds INTEGER DEFAULT 900, -- 15 minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for rate_limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_unique_key_window ON rate_limits(key, window_start);

-- Insert default admin user (for development)
INSERT INTO user_preferences (user_id, preferences) 
VALUES ('admin@simplebeacon.ai', '{"theme": "dark", "notifications": true, "language": "en"}')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_preferences (user_id, preferences) 
VALUES ('dev@simplebeacon.ai', '{"theme": "light", "notifications": true, "language": "en"}')
ON CONFLICT (user_id) DO NOTHING;

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_results_updated_at BEFORE UPDATE ON scan_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for recent audit logs
CREATE OR REPLACE VIEW recent_audit_logs AS
SELECT 
    id,
    timestamp,
    level,
    event_type,
    user_id,
    ip_address,
    request_method,
    request_path,
    response_status,
    duration_ms,
    message
FROM audit_logs 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Create view for active user sessions
CREATE OR REPLACE VIEW active_user_sessions AS
SELECT 
    id,
    user_id,
    created_at,
    last_accessed,
    ip_address,
    user_agent,
    expires_at
FROM user_sessions 
WHERE is_active = true AND expires_at > NOW()
ORDER BY last_accessed DESC;

-- Create view for scan statistics
CREATE OR REPLACE VIEW scan_statistics AS
SELECT 
    DATE_TRUNC('day', started_at) as scan_date,
    COUNT(*) as total_scans,
    COUNT(CASE WHEN gate_status = 'pass' THEN 1 END) as passed_scans,
    COUNT(CASE WHEN gate_status = 'fail' THEN 1 END) as failed_scans,
    AVG(scan_duration_ms) as avg_duration_ms,
    AVG(quality_score) as avg_quality_score
FROM scan_results 
WHERE started_at >= DATE_TRUNC('day', NOW() - INTERVAL '30 days')
GROUP BY DATE_TRUNC('day', started_at)
ORDER BY scan_date DESC;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO simplebeacon_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO simplebeacon_user;

-- Log initialization completion
INSERT INTO audit_logs (level, event_type, message, metadata)
VALUES ('INFO', 'DATABASE_INIT', 'Phase 2 database initialization completed', '{"version": "1.0.0", "timestamp": "' || NOW() || '"}');
