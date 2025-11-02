#!/usr/bin/env node
/**
 * AICIN - Database Schema Inspector
 * Checks what tables and columns exist in the learningai365 database
 */

const { Pool } = require('pg');

// Validate required environment variables
if (!process.env.DATABASE_PASSWORD) {
  console.error('❌ ERROR: DATABASE_PASSWORD environment variable is required');
  console.log('Set it with: export DATABASE_PASSWORD="your-database-password"');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'learningai365-postgres.cqdxs05ukdwt.us-west-2.rds.amazonaws.com',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'learningai365',
  user: process.env.DATABASE_USERNAME || 'learningai_admin',
  password: process.env.DATABASE_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function inspectSchema() {
  console.log('\n🔍 Database Schema Inspector\n');
  console.log(`Database: ${process.env.DATABASE_NAME || 'learningai365'}\n`);

  try {
    // Check if required tables exist
    console.log('📋 Checking for required tables:\n');

    const tables = [
      'learning_paths',
      'courses',
      'learning_paths_courses_lnk',
      'quiz_submissions',
      'quiz_recommendations',
      'up_users'
    ];

    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )
      `, [table]);

      const exists = result.rows[0].exists;
      console.log(`  ${exists ? '✓' : '✗'} ${table}`);

      if (exists) {
        // Get columns for existing tables
        const colResult = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = $1
          ORDER BY ordinal_position
        `, [table]);

        console.log(`      Columns (${colResult.rows.length}):`);
        colResult.rows.forEach(col => {
          console.log(`        - ${col.column_name} (${col.data_type}${col.is_nullable === 'NO' ? ', NOT NULL' : ''})`);
        });
        console.log('');
      }
    }

    // List all tables in the database
    console.log('\n📊 All tables in database:\n');
    const allTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    allTables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    console.log(`\nTotal tables: ${allTables.rows.length}\n`);

  } catch (error) {
    console.error('❌ Error inspecting schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

inspectSchema();
