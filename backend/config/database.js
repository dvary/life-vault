const { Pool } = require('pg');
require('dotenv').config();

// Support both DATABASE_URL and individual connection parameters
let poolConfig;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided (for Docker deployments)
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: false, // Disable SSL for local Docker deployment
  };
} else {
  // Fall back to individual connection parameters
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'family_health_tracker',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: false, // Disable SSL for local Docker deployment
  };
}

// Add connection pooling configuration
poolConfig.max = 20; // Maximum number of clients in the pool
poolConfig.idleTimeoutMillis = 30000; // Close idle clients after 30 seconds
poolConfig.connectionTimeoutMillis = 2000; // Return an error after 2 seconds if connection could not be established
poolConfig.allowExitOnIdle = true; // Allow the pool to close all connections and exit when idle

const pool = new Pool(poolConfig);

// Test the connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
