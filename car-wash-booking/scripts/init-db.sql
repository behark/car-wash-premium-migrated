-- Production database initialization script
-- This file will be executed when the PostgreSQL container starts

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE carwash'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'carwash');

-- Extensions that might be useful
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Performance settings for production
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET log_statement = 'none';
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Reload configuration
SELECT pg_reload_conf();