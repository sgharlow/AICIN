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
  calculateRelevance(query: string, documentIndex: number): number {
    if (!query || query.trim().length === 0) {
      return 0;
    }

    const queryTokens = this.preprocessText(query);

    if (queryTokens.length === 0) {
      return 0;
    }

    let totalScore = 0;

    queryTokens.forEach(term => {
      this.tfidf.tfidfs(term, (i: number, measure: number) => {
        if (i === documentIndex) {
          totalScore += measure;
        }
      });
    });

    // Normalize by query length
    return totalScore / queryTokens.length;
  }

  /**
   * Calculate content scores for all documents given a query
   * Returns map of documentId -> relevance score
   */
  calculateAllScores(query: string): Map<string, number> {
    const scores = new Map<string, number>();

    for (let i = 0; i < this.learningPathIds.length; i++) {
      const score = this.calculateRelevance(query, i);
      scores.set(this.learningPathIds[i], score);
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
