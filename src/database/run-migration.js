const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    // Read database configuration
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306,
        database: process.env.DB_NAME || 'chanitec',
        multipleStatements: true
    };

    try {
        console.log('Attempting to connect to MySQL...');
        const connection = await mysql.createConnection(config);
        console.log('Successfully connected to MySQL server');

        // Read and execute migration file
        const migrationPath = path.join(__dirname, 'migrations', '001_create_items_table.sql');
        const migration = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running migration...');
        await connection.query(migration);
        console.log('Migration completed successfully!');

        await connection.end();
    } catch (error) {
        console.error('Error running migration:', error);
        process.exit(1);
    }
}

// Run the migration
runMigration();