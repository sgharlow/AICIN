#!/usr/bin/env node
/**
 * AICIN - Learning Paths Diagnostic Tool
 * Analyzes learning paths to understand TF-IDF scoring issues
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

async function diagnoseLearningPaths() {
  console.log('\n🔍 Learning Paths Diagnostic Analysis\n');
  console.log('═'.repeat(70));

  try {
    // 1. Count and basic stats
    console.log('\n📊 BASIC STATISTICS:\n');
    const basicStats = await pool.query(`
      SELECT
        COUNT(*) as total_paths,
        AVG(LENGTH(description)) as avg_desc_length,
        MIN(LENGTH(description)) as min_desc_length,
        MAX(LENGTH(description)) as max_desc_length,
        AVG(completeness_score) as avg_completeness,
        MIN(completeness_score) as min_completeness,
        MAX(completeness_score) as max_completeness,
        COUNT(CASE WHEN description IS NULL OR description = '' THEN 1 END) as missing_descriptions
      FROM learning_paths
    `);

    const stats = basicStats.rows[0];
    console.log(`  Total Learning Paths:     ${stats.total_paths}`);
    console.log(`  Missing Descriptions:     ${stats.missing_descriptions}`);
    console.log(`  Avg Description Length:   ${Math.round(stats.avg_desc_length)} chars`);
    console.log(`  Min/Max Description:      ${stats.min_desc_length} / ${stats.max_desc_length} chars`);
    console.log(`  Avg Completeness Score:   ${stats.avg_completeness?.toFixed(1) || 'N/A'}`);
    console.log(`  Min/Max Completeness:     ${stats.min_completeness || 'N/A'} / ${stats.max_completeness || 'N/A'}`);

    // 2. Completeness score distribution
    console.log('\n📈 COMPLETENESS SCORE DISTRIBUTION:\n');
    const completenessDistribution = await pool.query(`
      SELECT
        CASE
          WHEN completeness_score IS NULL THEN 'NULL'
          WHEN completeness_score < 30 THEN '0-30'
          WHEN completeness_score < 50 THEN '30-50'
          WHEN completeness_score < 70 THEN '50-70'
          WHEN completeness_score < 90 THEN '70-90'
          ELSE '90-100'
        END as completeness_range,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM learning_paths), 1) as percentage
      FROM learning_paths
      GROUP BY completeness_range
      ORDER BY
        CASE completeness_range
          WHEN 'NULL' THEN 0
          WHEN '0-30' THEN 1
          WHEN '30-50' THEN 2
          WHEN '50-70' THEN 3
          WHEN '70-90' THEN 4
          ELSE 5
        END
    `);

    completenessDistribution.rows.forEach(row => {
      console.log(`  ${row.completeness_range.padEnd(10)} ${row.count.toString().padStart(4)} paths (${row.percentage}%)`);
    });

    // 3. Level distribution
    console.log('\n🎓 DIFFICULTY LEVEL DISTRIBUTION:\n');
    const levelDistribution = await pool.query(`
      SELECT
        COALESCE(level, 'NULL') as level,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM learning_paths), 1) as percentage
      FROM learning_paths
      GROUP BY level
      ORDER BY count DESC
    `);

    levelDistribution.rows.forEach(row => {
      console.log(`  ${row.level.padEnd(15)} ${row.count.toString().padStart(4)} paths (${row.percentage}%)`);
    });

    // 4. Topic analysis
    console.log('\n🏷️  TOPIC ANALYSIS:\n');
    const topicStats = await pool.query(`
      SELECT
        COUNT(CASE WHEN topics IS NOT NULL AND topics != '[]' THEN 1 END) as paths_with_topics,
        COUNT(CASE WHEN topics IS NULL OR topics = '[]' THEN 1 END) as paths_without_topics
      FROM learning_paths
    `);

    const topicStat = topicStats.rows[0];
    console.log(`  Paths WITH topics:        ${topicStat.paths_with_topics}`);
    console.log(`  Paths WITHOUT topics:     ${topicStat.paths_without_topics}`);

    // 5. Sample descriptions
    console.log('\n📝 SAMPLE LEARNING PATH DESCRIPTIONS:\n');
    const samples = await pool.query(`
      SELECT
        document_id,
        title,
        LEFT(description, 150) as description_preview,
        LENGTH(description) as desc_length,
        completeness_score,
        level,
        CASE
          WHEN topics IS NULL OR topics = '[]' THEN 'No topics'
          ELSE SUBSTRING(topics::text, 1, 80)
        END as topics_preview
      FROM learning_paths
      WHERE description IS NOT NULL AND description != ''
      ORDER BY RANDOM()
      LIMIT 5
    `);

    samples.rows.forEach((path, idx) => {
      console.log(`  ${idx + 1}. ${path.title || 'Untitled'}`);
      console.log(`     ID: ${path.document_id}`);
      console.log(`     Level: ${path.level || 'N/A'} | Completeness: ${path.completeness_score || 'N/A'}`);
      console.log(`     Description (${path.desc_length} chars): ${path.description_preview}...`);
      console.log(`     Topics: ${path.topics_preview}`);
      console.log('');
    });

    // 6. TF-IDF relevance check - paths with keywords
    console.log('\n🔍 TF-IDF KEYWORD ANALYSIS:\n');
    const keywordAnalysis = await pool.query(`
      SELECT
        'machine learning' as keyword,
        COUNT(*) as paths_matching,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM learning_paths), 1) as percentage
      FROM learning_paths
      WHERE LOWER(description) LIKE '%machine learning%'
      UNION ALL
      SELECT
        'deep learning' as keyword,
        COUNT(*) as paths_matching,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM learning_paths), 1) as percentage
      FROM learning_paths
      WHERE LOWER(description) LIKE '%deep learning%'
      UNION ALL
      SELECT
        'ai' as keyword,
        COUNT(*) as paths_matching,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM learning_paths), 1) as percentage
      FROM learning_paths
      WHERE LOWER(description) LIKE '%ai%' OR LOWER(description) LIKE '%artificial intelligence%'
      UNION ALL
      SELECT
        'healthcare' as keyword,
        COUNT(*) as paths_matching,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM learning_paths), 1) as percentage
      FROM learning_paths
      WHERE LOWER(description) LIKE '%healthcare%' OR LOWER(description) LIKE '%medical%'
      UNION ALL
      SELECT
        'nlp' as keyword,
        COUNT(*) as paths_matching,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM learning_paths), 1) as percentage
      FROM learning_paths
      WHERE LOWER(description) LIKE '%nlp%' OR LOWER(description) LIKE '%natural language%'
    `);

    console.log('  Keyword coverage (how many paths mention each term):');
    keywordAnalysis.rows.forEach(row => {
      console.log(`    ${row.keyword.padEnd(20)} ${row.paths_matching.toString().padStart(4)} paths (${row.percentage}%)`);
    });

    console.log('\n' + '═'.repeat(70));
    console.log('\n✅ Diagnostic complete!\n');

  } catch (error) {
    console.error('❌ Error analyzing learning paths:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

diagnoseLearningPaths();
