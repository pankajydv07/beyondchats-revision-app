/**
 * RAG (Retrieval-Augmented Generation) utility functions
 */

/**
 * Construct RAG prompt with retrieved chunks and conversation context
 * @param {string} userMessage - Current user message
 * @param {Array} retrievedChunks - Most relevant PDF chunks
 * @param {Object} conversationContext - Optional conversation history
 * @param {Object} options - Optional configuration
 */
function constructRAGPrompt(userMessage, retrievedChunks, conversationContext = null, options = {}) {
  const {
    maxChunks = 8,           // Limit chunks to prevent token overflow
    includeContextSummary = true,
    includeSimilarityScores = false
  } = options;

  // Select top N most relevant chunks to avoid prompt bloat
  const selectedChunks = retrievedChunks
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, maxChunks);

  // Build context from selected chunks with better page formatting
  const contextParts = selectedChunks.map((chunk, index) => {
    const pageInfo = chunk.pageRange || chunk.page;
    const confidence = chunk.metadata?.confidence || 'medium';
    
    let chunkText = `[${index + 1}] Page ${pageInfo}: ${chunk.text}`;
    
    if (includeSimilarityScores && chunk.similarity) {
      chunkText += ` (relevance: ${Math.round(chunk.similarity * 100)}%)`;
    }
    
    // Add confidence indicator in development
    if (includeSimilarityScores && confidence !== 'high') {
      chunkText += ` (page estimation: ${confidence})`;
    }
    
    return chunkText;
  }).join('\n\n');

  // Build conversation context summary if available
  let conversationSummary = '';
  if (includeContextSummary && conversationContext?.messages?.length > 0) {
    const recentMessages = conversationContext.messages.slice(-6); // Last 3 exchanges
    const summaryParts = recentMessages.map(msg => 
      `${msg.role === 'user' ? 'Student' : 'Assistant'}: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`
    );
    conversationSummary = `\n\nRecent conversation context:\n${summaryParts.join('\n')}\n`;
  }

  const prompt = `Use ONLY the provided context to answer the user's question. If the answer cannot be found in the context, say so clearly. 

IMPORTANT CITATION RULES:
- ALWAYS cite page numbers when referencing information
- Use the EXACT page numbers provided in the context (e.g., "Page 5" or "Page 3-4" for content spanning pages)
- Include direct quotes when possible to support your answer
- If page numbers appear as ranges (e.g., "Page 2-3"), the content spans multiple pages${conversationSummary}

Context from PDF:
${contextParts}

Current question: ${userMessage}

Please provide your response in the following JSON format:
{
  "answer": "Your detailed answer here, citing specific page numbers (e.g., 'According to page 5...' or 'As stated on pages 2-3...')",
  "citations": [
    {"page": "5", "snippet": "exact text snippet from that page with key information"},
    {"page": "2-3", "snippet": "snippet for content spanning multiple pages"}
  ]
}`;

  return prompt;
}

/**
 * Extract citations from retrieved chunks with enhanced page information
 */
function extractCitations(retrievedChunks) {
  return retrievedChunks.map(chunk => {
    // Use pageRange if available for better accuracy
    const pageInfo = chunk.pageRange || chunk.page;
    const confidence = chunk.metadata?.confidence || 'medium';
    
    return {
      page: pageInfo,
      snippet: chunk.text.substring(0, 150) + (chunk.text.length > 150 ? '...' : ''),
      similarity: Math.round((chunk.similarity || 0) * 100) / 100,
      confidence: confidence // Add confidence indicator
    };
  });
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
 * Enhanced JSON parsing with multiple fallback strategies
 * @param {string} responseText - Raw AI response
 * @returns {Object} Parsed response with answer and citations
 */
function parseAIResponse(responseText) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Strategy 1: Direct JSON parsing
  try {
    const parsed = JSON.parse(responseText.trim());
    if (parsed.answer) {
      return validateParsedResponse(parsed);
    }
  } catch (error) {
    if (isDevelopment) {
      console.log('Direct JSON parse failed:', error.message);
    }
  }

  // Strategy 2: Extract JSON substring
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.answer) {
        return validateParsedResponse(parsed);
      }
    }
  } catch (error) {
    if (isDevelopment) {
      console.log('JSON substring extraction failed:', error.message);
    }
  }

  // Strategy 3: Find JSON between markers or code blocks
  try {
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (parsed.answer) {
        return validateParsedResponse(parsed);
      }
    }
  } catch (error) {
    if (isDevelopment) {
      console.log('Code block JSON extraction failed:', error.message);
    }
  }

  // Strategy 4: Intelligent extraction of answer and citations
  try {
    const extracted = extractStructuredContent(responseText);
    if (extracted.answer) {
      return extracted;
    }
  } catch (error) {
    if (isDevelopment) {
      console.log('Intelligent extraction failed:', error.message);
    }
  }

  // Fallback: Use raw response
  if (isDevelopment) {
    console.log('All parsing strategies failed, using raw response');
  }
  
  return {
    answer: responseText.trim() || 'I apologize, but I encountered an error processing your question.',
    citations: []
  };
}

/**
 * Validate and clean parsed response structure
 */
function validateParsedResponse(parsed) {
  const validated = {
    answer: parsed.answer || '',
    citations: []
  };

  // Validate citations structure with enhanced page format support
  if (Array.isArray(parsed.citations)) {
    validated.citations = parsed.citations.filter(citation => 
      citation && 
      typeof citation === 'object' && 
      (typeof citation.page === 'number' || 
       typeof citation.page === 'string' && citation.page.length > 0) && 
      typeof citation.snippet === 'string'
    ).map(citation => {
      // Handle both numeric and string page formats (including ranges like "2-3")
      let pageValue = citation.page;
      if (typeof pageValue === 'number') {
        pageValue = pageValue.toString();
      }
      
      return {
        page: pageValue,
        snippet: citation.snippet.substring(0, 200), // Limit snippet length
        confidence: citation.confidence || 'medium'
      };
    });
  }

  return validated;
}

/**
 * Extract answer and citations from unstructured text
 */
function extractStructuredContent(text) {
  // Look for answer patterns
  let answer = '';
  let citations = [];

  // Try to find answer after common patterns
  const answerPatterns = [
    /answer["\s]*:[\s]*["']?(.*?)["']?(?:\n|$)/is,
    /response["\s]*:[\s]*["']?(.*?)["']?(?:\n|$)/is,
    /explanation["\s]*:[\s]*["']?(.*?)["']?(?:\n|$)/is
  ];

  for (const pattern of answerPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 10) {
      answer = match[1].trim();
      break;
    }
  }

  // If no structured answer found, use the text as is (cleaned)
  if (!answer) {
    answer = text.replace(/^[^a-zA-Z0-9]*/, '').trim();
  }

  // Try to extract page references for citations
  const pageRefs = text.match(/page\s+(\d+)/gi);
  if (pageRefs) {
    citations = pageRefs.map(ref => {
      const pageNum = parseInt(ref.match(/\d+/)[0]);
      const context = text.substring(
        Math.max(0, text.indexOf(ref) - 50),
        text.indexOf(ref) + 100
      );
      return {
        page: pageNum,
        snippet: context.trim()
      };
    }).filter((citation, index, self) => 
      // Remove duplicates by page number
      index === self.findIndex(c => c.page === citation.page)
    );
  }

  return { answer, citations };
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

/**
 * Calculate estimated token count for prompt optimization
 */
function estimateTokenCount(text) {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Log RAG operation details (development only or essential info)
 */
function logRAGOperation(operation, data, force = false) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment && !force) return;
  
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] RAG ${operation}:`, data);
}

export {
  constructRAGPrompt,
  extractCitations,
  sanitizeMessage,
  parseAIResponse,
  createSystemPrompt,
  truncateContext,
  estimateTokenCount,
  logRAGOperation
}