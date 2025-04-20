const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
    // Read database configuration
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true // Allow multiple statements
    };

    try {
        console.log('Attempting to connect to MySQL...');
        console.log('Using configuration:', {
            host: config.host,
            user: config.user,
            port: config.port
        });

        // Create connection without database
        const connection = await mysql.createConnection(config);
        console.log('Successfully connected to MySQL server');

        // Read and execute schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Split the schema into individual statements
        const statements = schema.split(';').filter(statement => statement.trim());

        console.log('Executing schema...');
        // Execute each statement
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await connection.query(statement);
                    console.log('✓ Successfully executed:', statement.split('\n')[0].trim());
                } catch (error) {
                    console.error('✗ Error executing statement:', error.message);
                    console.error('Statement:', statement.split('\n')[0].trim());
                    throw error;
                }
            }
        }

        console.log('\n✅ Database initialized successfully!');
        await connection.end();
    } catch (error) {
        console.error('\n❌ Error initializing database:', error.message);

        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\nAuthentication failed. Please check your database credentials:');
            console.error('1. Make sure MySQL server is running');
            console.error('2. Verify your username and password in .env file');
            console.error('3. Ensure the user has proper permissions');
            console.error('\nCurrent configuration:');
            console.error(`Host: ${config.host}`);
            console.error(`User: ${config.user}`);
            console.error(`Port: ${config.port}`);
        }

        process.exit(1);
    }
}

// Run the initialization
initializeDatabase();