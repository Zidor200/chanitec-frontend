const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Log database configuration (without password)
console.log('Database Configuration:', {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    database: process.env.DB_NAME || 'chanitec',
    port: process.env.DB_PORT || 3306
});

if (!process.env.DB_PASSWORD) {
    console.error('Warning: DB_PASSWORD is not set in environment variables');
}

// Database configuration is handled through environment variables
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'chanitec',
    port: process.env.DB_PORT || 3306
});

// Test the connection
pool.getConnection()
    .then(connection => {
        console.log('Database connection successful');
        connection.release();
    })
    .catch(error => {
        console.error('Error connecting to the database:', error.message);
    });

module.exports = pool;