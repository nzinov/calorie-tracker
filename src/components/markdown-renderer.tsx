import React from 'react'

// Simple markdown renderer for assistant responses
export function MarkdownRenderer({ content }: { content: string }) {
  if (!content) {
    return <p className="text-xs md:text-sm whitespace-pre-wrap break-words"></p>
  }
  
  // Detect if content has markdown-like patterns
  const hasMarkdownPatterns = content.includes('**') || content.includes('*') || content.includes('_') || content.includes('#')
  
  if (!hasMarkdownPatterns) {
    // Plain text - render normally
    return <p className="text-xs md:text-sm whitespace-pre-wrap break-words">{content}</p>
  }
  
  // Convert markdown to HTML
  let html = convertBasicMarkdown(content)
  
  // Sanitize for security
  html = sanitizeForSafety(html)
  
  return (
    <div 
      className="text-xs md:text-sm whitespace-pre-wrap break-words"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function convertBasicMarkdown(text: string): string {
  let result = text
  
  // Headers
  result = result.replace(/^(#{1,6})\s+(.*)$/gm, (match, hashes, content) => {
    const level = hashes.length
    return `<h${level}>${content}</h${level}>`
  })
  
  // Bold (**text**)
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  
  // Italic (*text*)
  result = result.replace(/(^|\s)\*(.*?)\*($|\s)/g, '$1<em>$2</em>$3')
  
  return result
}

function sanitizeForSafety(html: string): string {
  // Allow only basic formatting tags
  const allowedTags = ['strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  
  // Remove script tags and on* attributes
  html = html.replace(/<script[^>]*>.*?<\/script>/gi, '')
  html = html.replace(/on\w+="[^"]*"/gi, '')
  
  // Only allow whitelisted tags
  return html.replace(/<\/?[^>]+>/g, (tag) => {
    const tagName = tag.replace(/<\/?(\w+)[^>]*>/, '$1')
    return allowedTags.includes(tagName) ? tag : escapeHtml(tag)
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}