/**
 * Populate Missing Data in Learning Paths
 * Updates NULL values for cost, hours, and topics
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function analyzeCourseData() {
  console.log('='.repeat(80));
  console.log('Step 1: Analyzing Available Course Data');
  console.log('='.repeat(80));

  const result = await pool.query(`
    SELECT
      COUNT(*) as total_courses,
      COUNT(price) as has_price,
      COUNT(total_hours) as has_hours,
      COUNT(topics) as has_topics,
      ROUND(AVG(price) FILTER (WHERE price IS NOT NULL), 2) as avg_price,
      ROUND(AVG(total_hours) FILTER (WHERE total_hours IS NOT NULL), 2) as avg_hours
    FROM courses
    WHERE published_at IS NOT NULL
  `);

  console.log('\nCourse Data Availability:');
  console.log(JSON.stringify(result.rows[0], null, 2));

  return result.rows[0];
}

async function testAggregation() {
  console.log('\n' + '='.repeat(80));
  console.log('Step 2: Testing Aggregation on Sample Paths');
  console.log('='.repeat(80));

  const result = await pool.query(`
    SELECT lp.id, lp.title,
           COUNT(c.id) as course_count,
           COALESCE(SUM(c.price), 0) as total_cost,
           COALESCE(SUM(c.total_hours), 0) as total_hours,
           array_agg(DISTINCT c.topics) FILTER (WHERE c.topics IS NOT NULL) as all_topics
    FROM learning_paths lp
    LEFT JOIN learning_paths_courses_lnk lpc ON lp.id = lpc.learning_path_id
    LEFT JOIN courses c ON c.id = lpc.course_id AND c.published_at IS NOT NULL
    WHERE lp.is_active = true
      AND (lp.title ILIKE '%computer%vision%' OR lp.title ILIKE '%machine%learning%')
    GROUP BY lp.id, lp.title
    LIMIT 5
  `);

  console.log('\nSample Aggregations:');
  result.rows.forEach(r => {
    console.log(`\n${r.title}:`);
    console.log(`  Courses: ${r.course_count}`);
    console.log(`  Total Cost: $${r.total_cost}`);
    console.log(`  Total Hours: ${r.total_hours}`);
    console.log(`  Has Topics: ${r.all_topics ? 'Yes' : 'No'}`);
  });

  return result.rows;
}

async function updatePaths(dryRun = true) {
  console.log('\n' + '='.repeat(80));
  console.log(`Step 3: ${dryRun ? 'DRY RUN -' : ''} Updating Learning Paths`);
  console.log('='.repeat(80));

  // First, get the data we'll update
  const preview = await pool.query(`
    SELECT lp.id, lp.title,
           lp.total_cost as current_cost,
           lp.total_realistic_hours as current_hours,
           COALESCE(SUM(c.price), 0) as new_cost,
           COALESCE(SUM(c.total_hours), 0) as new_hours
    FROM learning_paths lp
    LEFT JOIN learning_paths_courses_lnk lpc ON lp.id = lpc.learning_path_id
    LEFT JOIN courses c ON c.id = lpc.course_id AND c.published_at IS NOT NULL
    WHERE lp.is_active = true
      AND lp.published_at IS NOT NULL
      AND (lp.total_cost IS NULL OR lp.total_realistic_hours IS NULL)
    GROUP BY lp.id, lp.title, lp.total_cost, lp.total_realistic_hours
    ORDER BY lp.id
    LIMIT 10
  `);

  console.log(`\nPaths to update: ${preview.rows.length} (showing first 10)`);
  preview.rows.forEach(r => {
    console.log(`\n${r.title}:`);
    console.log(`  Cost: ${r.current_cost || 'NULL'} → $${r.new_cost}`);
    console.log(`  Hours: ${r.current_hours || 'NULL'} → ${r.new_hours}`);
  });

  if (!dryRun) {
    console.log('\nExecuting UPDATE...');

    const updateResult = await pool.query(`
      WITH aggregated AS (
        SELECT
          lp.id,
          COALESCE(SUM(c.price), 0) as computed_cost,
          COALESCE(SUM(c.total_hours), 0) as computed_hours
        FROM learning_paths lp
        LEFT JOIN learning_paths_courses_lnk lpc ON lp.id = lpc.learning_path_id
        LEFT JOIN courses c ON c.id = lpc.course_id AND c.published_at IS NOT NULL
        WHERE lp.is_active = true AND lp.published_at IS NOT NULL
        GROUP BY lp.id
      )
      UPDATE learning_paths lp
      SET
        total_cost = CASE
          WHEN lp.total_cost IS NULL THEN agg.computed_cost
          ELSE lp.total_cost
        END,
        total_realistic_hours = CASE
          WHEN lp.total_realistic_hours IS NULL THEN agg.computed_hours
          ELSE lp.total_realistic_hours
        END
      FROM aggregated agg
      WHERE lp.id = agg.id
        AND (lp.total_cost IS NULL OR lp.total_realistic_hours IS NULL)
    `);

    console.log(`\n✅ Updated ${updateResult.rowCount} paths`);
  } else {
    console.log('\n⚠️  DRY RUN - No changes made. Run with --execute to apply changes.');
  }
}

async function verifyResults() {
  console.log('\n' + '='.repeat(80));
  console.log('Step 4: Verifying Results');
  console.log('='.repeat(80));

  const result = await pool.query(`
    SELECT
      COUNT(*) as total_paths,
      COUNT(total_cost) as paths_with_cost,
      COUNT(total_realistic_hours) as paths_with_hours,
      ROUND(AVG(total_cost) FILTER (WHERE total_cost IS NOT NULL), 2) as avg_cost,
      ROUND(AVG(total_realistic_hours) FILTER (WHERE total_realistic_hours IS NOT NULL), 2) as avg_hours
    FROM learning_paths
    WHERE is_active = true AND published_at IS NOT NULL
  `);

  console.log('\nLearning Paths After Update:');
  console.log(JSON.stringify(result.rows[0], null, 2));

  const sample = await pool.query(`
    SELECT title, total_cost, total_realistic_hours
    FROM learning_paths
    WHERE is_active = true
      AND published_at IS NOT NULL
      AND (title ILIKE '%computer%vision%' OR title ILIKE '%machine%learning%')
    ORDER BY title
    LIMIT 5
  `);

  console.log('\nSample Paths:');
  sample.rows.forEach(r => {
    console.log(`${r.title}: $${r.total_cost || 'NULL'}, ${r.total_realistic_hours || 'NULL'}h`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');

  try {
    await analyzeCourseData();
    await testAggregation();
    await updatePaths(!execute);

    if (execute) {
      await verifyResults();
    }

    console.log('\n' + '='.repeat(80));
    console.log('COMPLETE');
    console.log('='.repeat(80));

    if (!execute) {
      console.log('\nTo apply these changes, run:');
      console.log('  node populate-missing-data.js --execute');
    }

  } catch (error) {
    console.error('\nERROR:', error);
  } finally {
    await pool.end();
  }
}

main();
