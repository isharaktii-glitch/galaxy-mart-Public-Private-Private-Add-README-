const { Pool } = require('pg');

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create pool with optimized settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Log pool events
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err.message);
});

// Test connection immediately
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Database query test successful'))
  .catch(err => console.error('❌ Database query test failed:', err.message));

// Export a robust query function with retry logic
module.exports = {
  query: async (text, params) => {
    let client;
    let retries = 3;
    
    while (retries > 0) {
      try {
        client = await pool.connect();
        const result = await client.query(text, params);
        return result;
      } catch (err) {
        console.error(`Query error (${retries} retries left):`, err.message);
        if (client) {
          try { client.release(); } catch(e) {}
        }
        retries--;
        if (retries === 0) {
          console.error('❌ Final query failure:', text, params);
          throw new Error(`Database query failed after retries: ${err.message}`);
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      } finally {
        if (client) {
          try { client.release(); } catch(e) {}
        }
      }
    }
  }
};
