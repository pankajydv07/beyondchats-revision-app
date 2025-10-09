import React from 'react'
import PropTypes from 'prop-types'

// LaTeX rendering component with fallback handling
const LaTeXRenderer = ({ content }) => {
  // Parse text and identify LaTeX expressions
  const parseContent = (text) => {
    if (!text) return [{ type: 'text', content: '' }]
    
    const parts = []
    let currentIndex = 0
    
    // Regex patterns for LaTeX math delimiters
    const displayMathRegex = /\$\$([\s\S]*?)\$\$/g  // Display math: $$...$$
    const inlineMathRegex = /\$((?:\\\$|[^$])*?)\$/g  // Inline math: $...$
    
    // First, find all display math expressions
    const displayMatches = []
    let displayMatch
    while ((displayMatch = displayMathRegex.exec(text)) !== null) {
      displayMatches.push({
        type: 'display-math',
        content: displayMatch[1].trim(),
        start: displayMatch.index,
        end: displayMatch.index + displayMatch[0].length
      })
    }
    
    // Then find inline math expressions (avoiding display math areas)
    const inlineMatches = []
    let inlineMatch
    while ((inlineMatch = inlineMathRegex.exec(text)) !== null) {
      // Check if this inline match is inside a display math block
      const isInsideDisplayMath = displayMatches.some(dm => 
        inlineMatch.index >= dm.start && inlineMatch.index < dm.end
      )
      
      if (!isInsideDisplayMath) {
        inlineMatches.push({
          type: 'inline-math',
          content: inlineMatch[1].trim(),
          start: inlineMatch.index,
          end: inlineMatch.index + inlineMatch[0].length
        })
      }
    }
    
    // Combine and sort all matches by position
    const allMatches = [...displayMatches, ...inlineMatches].sort((a, b) => a.start - b.start)
    
    // Build the parts array
    allMatches.forEach((match, index) => {
      // Add text before this match
      if (match.start > currentIndex) {
        const textContent = text.slice(currentIndex, match.start)
        if (textContent) {
          parts.push({ type: 'text', content: textContent })
        }
      }
      
      // Add the math expression
      parts.push(match)
      currentIndex = match.end
    })
    
    // Add remaining text after last match
    if (currentIndex < text.length) {
      const textContent = text.slice(currentIndex)
      if (textContent) {
        parts.push({ type: 'text', content: textContent })
      }
    }
    
    // If no math expressions found, return the whole text
    if (parts.length === 0) {
      parts.push({ type: 'text', content: text })
    }
    
    return parts
  }
  
  // Format non-math text content (preserve existing formatting)
  const formatTextContent = (text) => {
    if (!text) return ''
    
    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    
    // Convert *italic* to <em>
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>')
    
    // Convert `code` to <code>
    text = text.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
    
    // Convert line breaks to <br>
    text = text.replace(/\n/g, '<br>')
    
    return text
  }
  
  // Render KaTeX math expression with fallback
  const renderMath = (expression, isDisplayMode = false) => {
    try {
      // For now, we'll use a simple fallback since KaTeX might not be available
      // This can be replaced with actual KaTeX rendering when the package is installed
      const katex = window.katex
      
      if (katex) {
        const html = katex.renderToString(expression, {
          displayMode: isDisplayMode,
          throwOnError: false,
          errorColor: '#cc0000'
        })
        
        return (
          <span
            className={isDisplayMode ? 'block text-center my-4' : 'inline'}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      } else {
        // Fallback: Show expression in a styled code block
        return (
          <code 
            className={`
              bg-yellow-50 border border-yellow-200 text-yellow-800 px-2 py-1 rounded font-mono text-sm
              ${isDisplayMode ? 'block text-center my-4' : 'inline'}
            `}
            title="LaTeX expression (KaTeX not loaded)"
          >
            {isDisplayMode ? `$$${expression}$$` : `$${expression}$`}
          </code>
        )
      }
    } catch (error) {
      console.warn('LaTeX rendering error:', error)
      // Error fallback: Show raw expression in code block
      return (
        <code 
          className={`
            bg-red-50 border border-red-200 text-red-800 px-2 py-1 rounded font-mono text-sm
            ${isDisplayMode ? 'block text-center my-4' : 'inline'}
          `}
          title={`LaTeX error: ${error.message}`}
        >
          {isDisplayMode ? `$$${expression}$$` : `$${expression}$`}
        </code>
      )
    }
  }
  
  // Parse and render the complete content
  const parts = parseContent(content)
  
  return (
    <div className="prose prose-sm max-w-none">
      {parts.map((part, index) => {
        switch (part.type) {
          case 'display-math':
            return (
              <div key={index} className="my-4">
                {renderMath(part.content, true)}
              </div>
            )
          case 'inline-math':
            return renderMath(part.content, false)
          case 'text':
          default:
            return (
              <span
                key={index}
                dangerouslySetInnerHTML={{ 
                  __html: formatTextContent(part.content) 
                }}
              />
            )
        }
      })}
    </div>
  )
}

LaTeXRenderer.propTypes = {
  content: PropTypes.string.isRequired
}

export default LaTeXRenderer