-- MySQL Schema for Chanitec Pricing System

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS chanitec;
USE chanitec;

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    client_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Items table (catalog of available items)
CREATE TABLE IF NOT EXISTS items (
    id CHAR(36) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
    id CHAR(36) PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    object TEXT,
    date DATE NOT NULL,
    supply_description TEXT,
    labor_description TEXT,
    supply_exchange_rate DECIMAL(10, 4) NOT NULL,
    supply_margin_rate DECIMAL(10, 4) NOT NULL,
    labor_exchange_rate DECIMAL(10, 4) NOT NULL,
    labor_margin_rate DECIMAL(10, 4) NOT NULL,
    total_supplies_ht DECIMAL(10, 2) NOT NULL,
    total_labor_ht DECIMAL(10, 2) NOT NULL,
    total_ht DECIMAL(10, 2) NOT NULL,
    tva DECIMAL(10, 2) NOT NULL,
    total_ttc DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Supply items table
CREATE TABLE IF NOT EXISTS supply_items (
    id CHAR(36) PRIMARY KEY,
    quote_id CHAR(36) NOT NULL,
    description TEXT NOT NULL,
    quantity INT NOT NULL,
    price_euro DECIMAL(10, 2) NOT NULL,
    price_dollar DECIMAL(10, 2) NOT NULL,
    unit_price_dollar DECIMAL(10, 2) NOT NULL,
    total_price_dollar DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

-- Labor items table
CREATE TABLE IF NOT EXISTS labor_items (
    id CHAR(36) PRIMARY KEY,
    quote_id CHAR(36) NOT NULL,
    description TEXT NOT NULL,
    nb_technicians INT NOT NULL,
    nb_hours DECIMAL(10, 2) NOT NULL,
    weekend_multiplier DECIMAL(10, 2) NOT NULL,
    price_euro DECIMAL(10, 2) NOT NULL,
    price_dollar DECIMAL(10, 2) NOT NULL,
    unit_price_dollar DECIMAL(10, 2) NOT NULL,
    total_price_dollar DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

-- Price Offers table
CREATE TABLE IF NOT EXISTS price_offers (
    id VARCHAR(36) PRIMARY KEY,
    quote_id VARCHAR(36) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    object TEXT,
    date DATE NOT NULL,
    supply_description TEXT,
    supply_total_ht DECIMAL(10,2) NOT NULL,
    labor_description TEXT,
    labor_total_ht DECIMAL(10,2) NOT NULL,
    total_ht DECIMAL(10,2) NOT NULL,
    tva DECIMAL(10,2) NOT NULL,
    total_ttc DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_clients_name ON clients;
DROP INDEX IF EXISTS idx_sites_client_id ON sites;
DROP INDEX IF EXISTS idx_sites_name ON sites;
DROP INDEX IF EXISTS idx_quotes_date ON quotes;
DROP INDEX IF EXISTS idx_quotes_client_name ON quotes;
DROP INDEX IF EXISTS idx_supply_items_quote_id ON supply_items;
DROP INDEX IF EXISTS idx_labor_items_quote_id ON labor_items;
DROP INDEX IF EXISTS idx_items_description ON items;

-- Create indexes for better performance
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_sites_client_id ON sites(client_id);
CREATE INDEX idx_sites_name ON sites(name);
CREATE INDEX idx_quotes_date ON quotes(date);
CREATE INDEX idx_quotes_client_name ON quotes(client_name);
CREATE INDEX idx_supply_items_quote_id ON supply_items(quote_id);
CREATE INDEX idx_labor_items_quote_id ON labor_items(quote_id);
CREATE INDEX idx_items_description ON items(description);

-- Add constraints
ALTER TABLE clients
    ADD CONSTRAINT chk_client_email CHECK (email IS NULL OR email LIKE '%@%.%');

ALTER TABLE quotes
    ADD CONSTRAINT chk_quote_rates CHECK (
        supply_exchange_rate > 0 AND
        supply_margin_rate > 0 AND
        labor_exchange_rate > 0 AND
        labor_margin_rate > 0
    );

ALTER TABLE supply_items
    ADD CONSTRAINT chk_supply_quantity CHECK (quantity > 0),
    ADD CONSTRAINT chk_supply_prices CHECK (
        price_euro > 0 AND
        price_dollar > 0 AND
        unit_price_dollar > 0 AND
        total_price_dollar > 0
    );

ALTER TABLE labor_items
    ADD CONSTRAINT chk_labor_technicians CHECK (nb_technicians > 0),
    ADD CONSTRAINT chk_labor_hours CHECK (nb_hours > 0),
    ADD CONSTRAINT chk_labor_multiplier CHECK (weekend_multiplier >= 1),
    ADD CONSTRAINT chk_labor_prices CHECK (
        price_euro > 0 AND
        price_dollar > 0 AND
        unit_price_dollar > 0 AND
        total_price_dollar > 0
    );