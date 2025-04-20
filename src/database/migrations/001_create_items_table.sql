-- Create items table if it doesn't exist
CREATE TABLE IF NOT EXISTS items (
    id CHAR(36) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Drop index if it exists (MySQL 5.7+ syntax)
DROP INDEX IF EXISTS idx_items_description ON items;

-- Create index on description for better search performance
CREATE INDEX idx_items_description ON items(description);