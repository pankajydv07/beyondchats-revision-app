import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Simple text-based similarity (fallback when embeddings aren't available)
 */
function textSimilarity(queryText, chunkText) {
  const queryWords = queryText.toLowerCase().split(/\s+/);
  const chunkWords = chunkText.toLowerCase().split(/\s+/);
  
  const querySet = new Set(queryWords);
  const chunkSet = new Set(chunkWords);
  
  const intersection = new Set([...querySet].filter(x => chunkSet.has(x)));
  const union = new Set([...querySet, ...chunkSet]);
  
  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Generate a simple embedding for text (mock implementation)
 * In production, you'd use a proper embedding model
 */
function generateMockEmbedding(text) {
  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Array(5).fill(0);
  
  // Simple hash-based embedding (not suitable for production)
  words.forEach((word, index) => {
    const hash = word.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    embedding[index % 5] += (hash % 100) / 100;
  });
  
  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => norm > 0 ? val / norm : 0);
}

/**
 * Load embeddings from JSON file
 */
function loadEmbeddings() {
  try {
    const embeddingsPath = path.join(__dirname, '..', 'data', 'embeddings.json');
    const data = fs.readFileSync(embeddingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading embeddings:', error);
    return { embeddings: {} };
  }
}

/**
 * Retrieve top-k most similar chunks for a given PDF and query
 */
function retrieveTopKChunks(pdfId, queryText, k = 5) {
  const embeddingsData = loadEmbeddings();
  const pdfEmbeddings = embeddingsData.embeddings[pdfId];
  
  if (!pdfEmbeddings || pdfEmbeddings.length === 0) {
    console.warn(`No embeddings found for PDF ID: ${pdfId}`);
    return [];
  }

  // Generate query embedding (mock)
  const queryEmbedding = generateMockEmbedding(queryText);
  
  // Calculate similarities
  const similarities = pdfEmbeddings.map(chunk => {
    let similarity;
    
    if (chunk.embedding && chunk.embedding.length > 0) {
      // Use cosine similarity with embeddings
      similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    } else {
      // Fallback to text similarity
      similarity = textSimilarity(queryText, chunk.text);
    }
    
    return {
      ...chunk,
      similarity
    };
  });
  
  // Sort by similarity and return top-k
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
    .map(chunk => ({
      id: chunk.id,
      text: chunk.text,
      page: chunk.page,
      similarity: chunk.similarity,
      metadata: chunk.metadata || {}
    }));
}

/**
 * Store embeddings for a PDF (for future use)
 */
function storeEmbeddings(pdfId, chunks) {
  try {
    const embeddingsData = loadEmbeddings();
    embeddingsData.embeddings[pdfId] = chunks;
    
    const embeddingsPath = path.join(__dirname, '..', 'data', 'embeddings.json');
    fs.writeFileSync(embeddingsPath, JSON.stringify(embeddingsData, null, 2));
    
    console.log(`Stored ${chunks.length} chunks for PDF: ${pdfId}`);
  } catch (error) {
    console.error('Error storing embeddings:', error);
  }
}

export {
  retrieveTopKChunks,
  storeEmbeddings,
  cosineSimilarity,
  textSimilarity,
  generateMockEmbedding
};