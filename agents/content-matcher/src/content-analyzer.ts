/**
 * ContentAnalyzer - TF-IDF based content analysis for learning paths
 * Migrated from Lambda quiz-service
 *
 * Implements Layer 1 (40% weight) of the hybrid matching system
 * Uses Natural.js for NLP preprocessing and TF-IDF scoring
 */

import * as natural from 'natural';
import type { EnrichedMetadata } from '@aicin/types';

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

export class ContentAnalyzer {
  private tfidf: any;
  private stemmer: any;
  private learningPathIds: string[];

  constructor() {
    this.tfidf = new TfIdf();
    this.stemmer = natural.PorterStemmer;
    this.learningPathIds = [];
  }

  /**
   * Preprocesses text by:
   * 1. Tokenizing into words
   * 2. Converting to lowercase
   * 3. Removing stopwords (common words like "the", "is", "with")
   * 4. Filtering short words (< 3 characters)
   * 5. Applying Porter stemming
   */
  preprocessText(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Tokenize and lowercase
    const tokens = tokenizer.tokenize(text.toLowerCase()) || [];

    // Filter and process tokens
    return tokens
      .filter(token => token.length > 2) // Remove short words
      .filter(token => !natural.stopwords.includes(token)) // Remove stopwords
      .map(token => this.stemmer.stem(token)); // Apply stemming
  }

  /**
   * Builds TF-IDF corpus from learning paths with weighted fields:
   * - Title: 3x weight (most important)
   * - Topics: 2x weight
   * - Description: 1x weight
   */
  buildCorpus(learningPaths: Array<{
    id: number | string;
    title: string;
    description?: string;
    topics?: string[]
  }>): void {
    this.learningPathIds = [];

    console.log(`[ContentAnalyzer] Building corpus from ${learningPaths.length} learning paths`);

    learningPaths.forEach(path => {
      // Apply field weighting
      const titleText = path.title.repeat(3); // 3x weight
      const descriptionText = path.description || '';
      const topicsText = (path.topics || []).join(' ').repeat(2); // 2x weight

      // Combine weighted text
      const combinedText = `${titleText} ${descriptionText} ${topicsText}`;

      // Preprocess and add to corpus
      const processedTokens = this.preprocessText(combinedText);
      this.tfidf.addDocument(processedTokens);

      // Track document ID mapping
      this.learningPathIds.push(path.id.toString());
    });

    console.log(`[ContentAnalyzer] Corpus built with ${this.learningPathIds.length} documents`);
  }

  /**
   * Extracts top N terms from a document sorted by TF-IDF score (descending)
   */
  extractTopTerms(documentIndex: number, topN: number = 10): Array<{ term: string; tfidf: number }> {
    const terms = this.tfidf.listTerms(documentIndex);

    return terms
      .slice(0, topN)
      .map((item: any) => ({
        term: item.term,
        tfidf: item.tfidf,
      }));
  }

  /**
   * Calculates relevance score between a query and a specific document
   * using TF-IDF scoring with query length normalization
   */
  calculateRelevance(query: string, documentIndex: number, debug = false): number {
    if (!query || query.trim().length === 0) {
      return 0;
    }

    const queryTokens = this.preprocessText(query);

    if (queryTokens.length === 0) {
      return 0;
    }

    let totalScore = 0;
    const termScores: Record<string, number> = {};

    queryTokens.forEach(term => {
      this.tfidf.tfidfs(term, (i: number, measure: number) => {
        if (i === documentIndex) {
          totalScore += measure;
          termScores[term] = measure;
        }
      });
    });

    // Normalize by query length
    const normalizedScore = totalScore / queryTokens.length;

    // Debug logging for first 3 documents
    if (debug && documentIndex < 3) {
      console.log(`  [TF-IDF DEBUG] Document ${documentIndex}:`);
      console.log(`    Query tokens (${queryTokens.length}): ${queryTokens.slice(0, 5).join(', ')}${queryTokens.length > 5 ? '...' : ''}`);
      console.log(`    Total raw score: ${totalScore.toFixed(4)}`);
      console.log(`    Normalized score: ${normalizedScore.toFixed(4)} (÷ ${queryTokens.length})`);
      const topTerms = Object.entries(termScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      if (topTerms.length > 0) {
        console.log(`    Top term scores: ${topTerms.map(([t, s]) => `${t}=${s.toFixed(4)}`).join(', ')}`);
      }
    }

    return normalizedScore;
  }

  /**
   * Calculate content scores for all documents given a query
   * Returns map of documentId -> relevance score
   */
  calculateAllScores(query: string, debug = false): Map<string, number> {
    const scores = new Map<string, number>();

    if (debug) {
      console.log(`[TF-IDF] Calculating scores for ${this.learningPathIds.length} documents...`);
    }

    for (let i = 0; i < this.learningPathIds.length; i++) {
      const score = this.calculateRelevance(query, i, debug);
      scores.set(this.learningPathIds[i], score);
    }

    if (debug) {
      // Calculate score statistics
      const scoreArray = Array.from(scores.values());
      const min = Math.min(...scoreArray);
      const max = Math.max(...scoreArray);
      const avg = scoreArray.reduce((sum, s) => sum + s, 0) / scoreArray.length;
      const median = scoreArray.sort((a, b) => a - b)[Math.floor(scoreArray.length / 2)];

      console.log(`[TF-IDF] Score Distribution:`);
      console.log(`  Min: ${min.toFixed(4)} | Max: ${max.toFixed(4)}`);
      console.log(`  Avg: ${avg.toFixed(4)} | Median: ${median.toFixed(4)}`);

      // Show distribution by ranges
      const ranges = {
        '0.0-0.1': 0,
        '0.1-0.2': 0,
        '0.2-0.3': 0,
        '0.3-0.5': 0,
        '0.5-1.0': 0,
        '1.0+': 0
      };

      scoreArray.forEach(s => {
        if (s < 0.1) ranges['0.0-0.1']++;
        else if (s < 0.2) ranges['0.1-0.2']++;
        else if (s < 0.3) ranges['0.2-0.3']++;
        else if (s < 0.5) ranges['0.3-0.5']++;
        else if (s < 1.0) ranges['0.5-1.0']++;
        else ranges['1.0+']++;
      });

      console.log(`  Distribution:`);
      Object.entries(ranges).forEach(([range, count]) => {
        const pct = ((count / scoreArray.length) * 100).toFixed(1);
        console.log(`    ${range}: ${count} paths (${pct}%)`);
      });
    }

    return scores;
  }

  /**
   * Get top N matching documents for a query
   */
  getTopMatches(query: string, topN: number = 10): Array<{ pathId: string; score: number }> {
    const scores = this.calculateAllScores(query);

    // Sort by score descending
    const sorted = Array.from(scores.entries())
      .map(([pathId, score]) => ({ pathId, score }))
      .sort((a, b) => b.score - a.score);

    return sorted.slice(0, topN);
  }

  /**
   * Enriches all learning paths in the corpus with content-based metadata
   */
  enrichAllPaths(learningPaths: Array<{
    id: number | string;
    title: string;
    description?: string;
    topics?: string[]
  }>): Map<string, EnrichedMetadata> {
    // Build corpus first if not already built
    if (this.learningPathIds.length === 0) {
      this.buildCorpus(learningPaths);
    }

    const enrichedData = new Map<string, EnrichedMetadata>();

    learningPaths.forEach((path, index) => {
      const topTerms = this.extractTopTerms(index, 15); // Top 15 terms
      const contentVector = topTerms.map(t => t.tfidf);

      enrichedData.set(path.id.toString(), {
        documentId: path.id.toString(),
        topTerms,
        contentVector,
      });
    });

    return enrichedData;
  }

  /**
   * Gets the document ID (learning path ID) for a given corpus index
   */
  getDocumentId(index: number): string {
    return this.learningPathIds[index];
  }

  /**
   * Get number of documents in corpus
   */
  getCorpusSize(): number {
    return this.learningPathIds.length;
  }
}
