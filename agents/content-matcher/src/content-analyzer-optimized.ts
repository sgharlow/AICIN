/**
 * ContentAnalyzer OPTIMIZED - TF-IDF with pre-computed vectors
 *
 * PERFORMANCE IMPROVEMENTS:
 * 1. Pre-compute TF-IDF vectors for all documents (done once)
 * 2. Cache query preprocessing (done once per query, not per document)
 * 3. Use vectorized dot product for similarity (O(n) instead of O(n²))
 *
 * Expected improvement: 2,300ms → 300-500ms (5-8x faster)
 */

import * as natural from 'natural';
import type { EnrichedMetadata } from '@aicin/types';

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

interface DocumentVector {
  pathId: string;
  terms: Map<string, number>; // term -> TF-IDF score
  magnitude: number; // Pre-computed vector magnitude for cosine similarity
}

export class ContentAnalyzerOptimized {
  private tfidf: any;
  private stemmer: any;
  private learningPathIds: string[];
  private documentVectors: DocumentVector[]; // PRE-COMPUTED VECTORS
  private vocabulary: Set<string>; // All unique terms in corpus

  constructor() {
    this.tfidf = new TfIdf();
    this.stemmer = natural.PorterStemmer;
    this.learningPathIds = [];
    this.documentVectors = [];
    this.vocabulary = new Set();
  }

  /**
   * Preprocesses text (same as original)
   */
  preprocessText(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const tokens = tokenizer.tokenize(text.toLowerCase()) || [];

    return tokens
      .filter(token => token.length > 2)
      .filter(token => !natural.stopwords.includes(token))
      .map(token => this.stemmer.stem(token));
  }

  /**
   * Builds TF-IDF corpus AND pre-computes document vectors
   * This is the KEY optimization - do the heavy lifting ONCE
   */
  buildCorpus(learningPaths: Array<{
    id: number | string;
    title: string;
    description?: string;
    topics?: string[]
  }>): void {
    const buildStart = Date.now();

    this.learningPathIds = [];
    this.documentVectors = [];
    this.vocabulary.clear();

    console.log(`[ContentAnalyzerOptimized] Building optimized corpus from ${learningPaths.length} paths`);

    // Step 1: Build TF-IDF corpus (original way)
    learningPaths.forEach(path => {
      const titleText = path.title.repeat(3);
      const descriptionText = path.description || '';
      const topicsText = (path.topics || []).join(' ').repeat(2);
      const combinedText = `${titleText} ${descriptionText} ${topicsText}`;

      const processedTokens = this.preprocessText(combinedText);
      this.tfidf.addDocument(processedTokens);
      this.learningPathIds.push(path.id.toString());

      // Track vocabulary
      processedTokens.forEach(token => this.vocabulary.add(token));
    });

    console.log(`[ContentAnalyzerOptimized] Corpus built, now pre-computing vectors...`);

    // Step 2: PRE-COMPUTE document vectors
    const vectorStart = Date.now();

    for (let docIndex = 0; docIndex < this.learningPathIds.length; docIndex++) {
      const pathId = this.learningPathIds[docIndex];
      const terms = new Map<string, number>();
      let magnitudeSquared = 0;

      // Extract ALL terms for this document
      const docTerms = this.tfidf.listTerms(docIndex);

      docTerms.forEach((item: any) => {
        const { term, tfidf } = item;
        terms.set(term, tfidf);
        magnitudeSquared += tfidf * tfidf;
      });

      this.documentVectors.push({
        pathId,
        terms,
        magnitude: Math.sqrt(magnitudeSquared)
      });
    }

    const vectorTime = Date.now() - vectorStart;
    const totalTime = Date.now() - buildStart;

    console.log(`[ContentAnalyzerOptimized] Vector pre-computation complete:`);
    console.log(`  Documents: ${this.learningPathIds.length}`);
    console.log(`  Vocabulary size: ${this.vocabulary.size} unique terms`);
    console.log(`  Vector build time: ${vectorTime}ms`);
    console.log(`  Total build time: ${totalTime}ms`);
  }

  /**
   * OPTIMIZED: Calculate query vector ONCE, then use dot product
   * This is O(n) instead of O(n²)
   */
  calculateAllScores(query: string, debug = false): Map<string, number> {
    const calcStart = Date.now();
    const scores = new Map<string, number>();

    if (!query || query.trim().length === 0) {
      return scores;
    }

    // PRE-PROCESS QUERY ONCE (not 244 times!)
    const queryTokens = this.preprocessText(query);

    if (queryTokens.length === 0) {
      return scores;
    }

    if (debug) {
      console.log(`[TF-IDF-OPT] Calculating scores for ${this.learningPathIds.length} documents...`);
      console.log(`  Query tokens (${queryTokens.length}): ${queryTokens.slice(0, 10).join(', ')}`);
    }

    // Build query vector (get TF-IDF weights for query terms)
    const queryVector = new Map<string, number>();
    let queryMagnitudeSquared = 0;

    queryTokens.forEach(term => {
      // Get IDF for this term across all documents
      let sumTfidf = 0;
      let count = 0;

      this.tfidf.tfidfs(term, (i: number, measure: number) => {
        sumTfidf += measure;
        count++;
      });

      const avgTfidf = count > 0 ? sumTfidf / count : 0;
      if (avgTfidf > 0) {
        queryVector.set(term, avgTfidf);
        queryMagnitudeSquared += avgTfidf * avgTfidf;
      }
    });

    const queryMagnitude = Math.sqrt(queryMagnitudeSquared);

    if (debug) {
      console.log(`  Query vector magnitude: ${queryMagnitude.toFixed(4)}`);
    }

    // VECTORIZED SCORING: Dot product for each document
    for (const docVector of this.documentVectors) {
      let dotProduct = 0;

      // Calculate dot product between query and document vectors
      queryVector.forEach((queryWeight, term) => {
        const docWeight = docVector.terms.get(term);
        if (docWeight !== undefined) {
          dotProduct += queryWeight * docWeight;
        }
      });

      // Cosine similarity (normalized by magnitudes)
      const similarity = (queryMagnitude > 0 && docVector.magnitude > 0)
        ? dotProduct / (queryMagnitude * docVector.magnitude)
        : 0;

      // Scale to match original TF-IDF scores (for compatibility)
      const scaledScore = similarity * queryTokens.length;

      scores.set(docVector.pathId, scaledScore);
    }

    const calcTime = Date.now() - calcStart;

    if (debug) {
      const scoreArray = Array.from(scores.values());
      const min = Math.min(...scoreArray);
      const max = Math.max(...scoreArray);
      const avg = scoreArray.reduce((sum, s) => sum + s, 0) / scoreArray.length;

      console.log(`[TF-IDF-OPT] Scoring complete in ${calcTime}ms`);
      console.log(`  Min: ${min.toFixed(4)} | Max: ${max.toFixed(4)} | Avg: ${avg.toFixed(4)}`);
    }

    return scores;
  }

  /**
   * Get top N matching documents (same as original)
   */
  getTopMatches(query: string, topN: number = 10): Array<{ pathId: string; score: number }> {
    const scores = this.calculateAllScores(query);

    const sorted = Array.from(scores.entries())
      .map(([pathId, score]) => ({ pathId, score }))
      .sort((a, b) => b.score - a.score);

    return sorted.slice(0, topN);
  }

  /**
   * Get corpus size
   */
  getCorpusSize(): number {
    return this.learningPathIds.length;
  }

  /**
   * Extract top terms (for enrichment)
   */
  extractTopTerms(documentIndex: number, topN: number = 10): Array<{ term: string; tfidf: number }> {
    if (documentIndex >= this.documentVectors.length) {
      return [];
    }

    const docVector = this.documentVectors[documentIndex];
    const terms = Array.from(docVector.terms.entries())
      .map(([term, tfidf]) => ({ term, tfidf }))
      .sort((a, b) => b.tfidf - a.tfidf)
      .slice(0, topN);

    return terms;
  }

  /**
   * Enrich all paths with metadata
   */
  enrichAllPaths(learningPaths: Array<{
    id: number | string;
    title: string;
    description?: string;
    topics?: string[]
  }>): Map<string, EnrichedMetadata> {
    if (this.learningPathIds.length === 0) {
      this.buildCorpus(learningPaths);
    }

    const enrichedData = new Map<string, EnrichedMetadata>();

    learningPaths.forEach((path, index) => {
      const topTerms = this.extractTopTerms(index, 15);
      const contentVector = topTerms.map(t => t.tfidf);

      enrichedData.set(path.id.toString(), {
        documentId: path.id.toString(),
        topTerms,
        contentVector,
      });
    });

    return enrichedData;
  }
}
