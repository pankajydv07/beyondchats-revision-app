/**
 * RAG (Retrieval-Augmented Generation) utility functions
 */

/**
 * Construct RAG prompt with retrieved chunks
 */
function constructRAGPrompt(userMessage, retrievedChunks) {
  // Build context from retrieved chunks
  const contextParts = retrievedChunks.map((chunk, index) => {
    return `[${index + 1}] Page ${chunk.page}: ${chunk.text}`;
  }).join('\n\n');

  const prompt = `Use ONLY the provided context to answer the user's question. If the answer cannot be found in the context, say so clearly. Always cite page numbers when referencing information.

Context:
${contextParts}

User question: ${userMessage}

Please provide your response in the following JSON format:
{
  "answer": "Your detailed answer here, citing page numbers where appropriate",
  "citations": [
    {"page": 1, "snippet": "relevant text snippet from that page"},
    {"page": 2, "snippet": "another relevant snippet"}
  ]
}`;

  return prompt;
}

/**
 * Extract citations from retrieved chunks
 */
function extractCitations(retrievedChunks) {
  return retrievedChunks.map(chunk => ({
    page: chunk.page,
    snippet: chunk.text.substring(0, 150) + (chunk.text.length > 150 ? '...' : ''),
    similarity: Math.round(chunk.similarity * 100) / 100
  }));
}

/**
 * Validate and sanitize user message
 */
function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') {
    throw new Error('Invalid message: must be a non-empty string');
  }
  
  // Remove potentially harmful content
  const sanitized = message
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .substring(0, 1000); // Limit length
  
  if (sanitized.length === 0) {
    throw new Error('Message cannot be empty after sanitization');
  }
  
  return sanitized;
}

/**
 * Parse AI response and validate JSON structure
 */
function parseAIResponse(responseText) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // If no JSON found, create a structured response
      return {
        answer: responseText.trim(),
        citations: []
      };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate structure
    if (!parsed.answer) {
      parsed.answer = responseText.trim();
    }
    
    if (!Array.isArray(parsed.citations)) {
      parsed.citations = [];
    }
    
    // Validate citations structure
    parsed.citations = parsed.citations.filter(citation => 
      citation && 
      typeof citation === 'object' && 
      typeof citation.page === 'number' && 
      typeof citation.snippet === 'string'
    );
    
    return parsed;
    
  } catch (error) {
    console.error('Error parsing AI response:', error);
    // Return fallback response
    return {
      answer: responseText.trim() || 'I apologize, but I encountered an error processing your question.',
      citations: []
    };
  }
}

/**
 * Create system prompt for the AI model
 */
function createSystemPrompt() {
  return `You are an intelligent assistant helping students understand their course materials. Your responses should be:

1. Accurate and based only on the provided context
2. Educational and easy to understand
3. Well-structured with clear explanations
4. Include specific page references when citing information
5. Acknowledge when information is not available in the context
6. Use LaTeX formatting for mathematical expressions:
   - Use $expression$ for inline math (e.g., $E=mc^2$)
   - Use $$expression$$ for display math (e.g., $$F = ma$$)
   - Always format equations, formulas, and mathematical symbols using LaTeX
   - Examples: $\\pi$, $\\alpha$, $\\beta$, $\\int_0^\\infty$, $\\frac{a}{b}$, $\\sqrt{x}$

Always respond in JSON format with "answer" and "citations" fields.`;
}

/**
 * Truncate context to fit within token limits
 */
function truncateContext(chunks, maxLength = 4000) {
  let totalLength = 0;
  const truncatedChunks = [];
  
  for (const chunk of chunks) {
    const chunkLength = chunk.text.length + 50; // Account for formatting
    if (totalLength + chunkLength > maxLength) {
      break;
    }
    truncatedChunks.push(chunk);
    totalLength += chunkLength;
  }
  
  return truncatedChunks;
}

export {
  constructRAGPrompt,
  extractCitations,
  sanitizeMessage,
  parseAIResponse,
  createSystemPrompt,
  truncateContext
};