-- ==========================================
-- MUAT-IN DATABASE SCHEMA & SEED DATA (POSTGRESQL / SUPABASE)
-- ==========================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Drop existing tables/types if they exist (for clean setup)
DROP TABLE IF EXISTS load_plan_items CASCADE;
DROP TABLE IF EXISTS load_plans CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS trucks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'dispatcher' NOT NULL CHECK (role IN ('admin', 'dispatcher', 'driver')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. TRUCKS TABLE
CREATE TABLE trucks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    plate_number VARCHAR(50) UNIQUE NOT NULL,
    length_cm NUMERIC(10, 2) NOT NULL CHECK (length_cm > 0),
    width_cm NUMERIC(10, 2) NOT NULL CHECK (width_cm > 0),
    height_cm NUMERIC(10, 2) NOT NULL CHECK (height_cm > 0),
    max_weight_kg NUMERIC(12, 2) NOT NULL CHECK (max_weight_kg > 0),
    max_volume_cbm NUMERIC(10, 2) NOT NULL CHECK (max_volume_cbm > 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. ITEMS TABLE
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    length_cm NUMERIC(10, 2) NOT NULL CHECK (length_cm > 0),
    width_cm NUMERIC(10, 2) NOT NULL CHECK (width_cm > 0),
    height_cm NUMERIC(10, 2) NOT NULL CHECK (height_cm > 0),
    weight_kg NUMERIC(10, 2) NOT NULL CHECK (weight_kg > 0),
    category VARCHAR(100) NOT NULL CHECK (category IN ('HEAVY', 'MEDIUM', 'LIGHT')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. LOAD PLANS TABLE
CREATE TABLE load_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    truck_id UUID REFERENCES trucks(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'calculated', 'manifested', 'completed')),
    total_items INTEGER DEFAULT 0 NOT NULL CHECK (total_items >= 0),
    total_weight_kg NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (total_weight_kg >= 0),
    total_volume_cbm NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (total_volume_cbm >= 0),
    weight_utilization_pct NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    volume_utilization_pct NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    cog_x NUMERIC(10, 2) DEFAULT 0.00 NOT NULL, -- Center of Gravity X (offset from center/origin)
    cog_y NUMERIC(10, 2) DEFAULT 0.00 NOT NULL, -- Center of Gravity Y
    cog_z NUMERIC(10, 2) DEFAULT 0.00 NOT NULL, -- Center of Gravity Z
    odol_risk_status VARCHAR(50) DEFAULT 'SAFE' NOT NULL CHECK (odol_risk_status IN ('SAFE', 'WARNING', 'DANGER')),
    odol_risk_details JSONB DEFAULT '{}'::jsonb NOT NULL,
    qr_code_payload TEXT,
    manifest_document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. LOAD PLAN ITEMS TABLE (Detailed coordinates of packed items)
CREATE TABLE load_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_plan_id UUID REFERENCES load_plans(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES items(id) ON DELETE RESTRICT NOT NULL,
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0), -- order of loading
    x_pos NUMERIC(10, 2) NOT NULL, -- X coordinate in truck (cm)
    y_pos NUMERIC(10, 2) NOT NULL, -- Y coordinate in truck (cm)
    z_pos NUMERIC(10, 2) NOT NULL, -- Z coordinate in truck (cm)
    rotation_state INTEGER DEFAULT 0 NOT NULL, -- Orientation state (0 = standard, 1 = rotated)
    is_placed BOOLEAN DEFAULT TRUE NOT NULL, -- false if item didn't fit
    weight_category VARCHAR(50) NOT NULL CHECK (weight_category IN ('heavy_red', 'medium_yellow', 'light_green')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ==========================================
-- INDEXING
-- ==========================================

-- Standard index on item code for fast exact search
CREATE INDEX idx_items_code ON items(code);

-- GIN Trigram index on items.name for fast case-insensitive partial match search
CREATE INDEX idx_items_name_trgm ON items USING gin (name gin_trgm_ops);

-- B-Tree index on items.name for prefix search sorting
CREATE INDEX idx_items_name ON items(name);

-- Foreign key indices for optimization on joins
CREATE INDEX idx_load_plans_user_id ON load_plans(user_id);
CREATE INDEX idx_load_plans_truck_id ON load_plans(truck_id);
CREATE INDEX idx_load_plan_items_load_plan_id ON load_plan_items(load_plan_id);
CREATE INDEX idx_load_plan_items_item_id ON load_plan_items(item_id);

-- ==========================================
-- TRIGGERS FOR UPDATED_AT COLUMN
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_load_plans_updated_at BEFORE UPDATE ON load_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- SAMPLE SEED DATA
-- ==========================================
-- ====================================================================
-- REVISED SEED DATA (BASED ON FIGMA UI SCREENS)
-- ====================================================================

-- 1. SEED USERS (Matches Profile Screen: Budi Santoso)
-- Password is 'password123' (bcrypt hashed)
INSERT INTO users (id, email, password_hash, name, role) VALUES
('b3c76a59-b1d6-4444-a149-c12e87900b11', 'admin@muatin.com', '$2b$10$wR39xepU3R2oK7yVqK.FaeZ/cvyV5K3XqQ4gq7gT7lI1Uly507Vq2', 'Super Admin Muat-In', 'admin'),
('b3c76a59-b1d6-4444-a149-c12e87900b22', 'budisantoso@gmail.com', '$2b$10$wR39xepU3R2oK7yVqK.FaeZ/cvyV5K3XqQ4gq7gT7lI1Uly507Vq2', 'Budi Santoso', 'dispatcher');

-- 2. SEED TRUCKS (Matches List Truk Screen)
INSERT INTO trucks (id, name, plate_number, length_cm, width_cm, height_cm, max_weight_kg, max_volume_cbm) VALUES
('1a1796c9-e74c-4e89-9831-29e8c464bf01', 'Truck only', 'B 9001 TKO', 400.00, 300.00, 300.00, 1000.00, 36.00),
('1a1796c9-e74c-4e89-9831-29e8c464bf02', 'Truck ini', 'B 9234 TKI', 1200.00, 1000.00, 150.00, 4000.00, 180.00),
('1a1796c9-e74c-4e89-9831-29e8c464bf03', 'Truck ono', 'B 9876 TKO', 600.00, 600.00, 800.00, 8500.00, 288.00),
('1a1796c9-e74c-4e89-9831-29e8c464bf04', 'Truck xxx', 'B 9999 XXX', 600.00, 600.00, 800.00, 8500.00, 288.00),
('1a1796c9-e74c-4e89-9831-29e8c464bf05', 'Truck III', 'B 9333 TLL', 600.00, 600.00, 800.00, 8500.00, 288.00);

-- 3. SEED ITEMS (Matches List Barang Screen)
INSERT INTO items (id, code, name, length_cm, width_cm, height_cm, weight_kg, category, description) VALUES
('5e2f7b88-12cd-42ee-b01a-65392df27001', 'PS-X2-440', 'Panel Surya Modul X2', 40.00, 30.00, 30.00, 12.00, 'LIGHT', 'Panel surya modul hemat energi X2'),
('5e2f7b88-12cd-42ee-b01a-65392df27002', 'INV-G3-5KW', 'Inverter Industrial G3', 120.00, 100.00, 15.00, 25.00, 'MEDIUM', 'Inverter industrial daya tinggi 5KW G3'),
('5e2f7b88-12cd-42ee-b01a-65392df27003', 'BAT-S10-MAX', 'Baterai Lithium S10', 60.00, 60.00, 80.00, 85.00, 'HEAVY', 'Baterai lithium berkapasitas besar S10 MAX');