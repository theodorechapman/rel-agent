/**
 * Style Analyzer Tool - Analyzes user's texting style from message history
 */

import { createTool } from '@mastra/core'
import { z } from 'zod'
import type { Message } from '@photon-ai/imessage-kit'

export const styleAnalyzerTool = createTool({
  id: 'analyze-user-style',
  description: 'Analyzes the last N messages from the user to understand their texting style, tone, vocabulary, and patterns.',
  inputSchema: z.object({
    messages: z.array(z.object({
      text: z.string(),
      date: z.string()
    })),
    count: z.number().default(50)
  }),
  outputSchema: z.object({
    tone: z.string(),
    averageLength: z.number(),
    commonPhrases: z.array(z.string()),
    emojiUsage: z.enum(['none', 'rare', 'frequent']),
    typingPatterns: z.string(),
    styleGuide: z.string()
  }),
  execute: async ({ context }) => {
    const { messages, count } = context
    const recentMessages = messages.slice(-count).filter(m => m.text && m.text.trim().length > 0)

    if (recentMessages.length === 0) {
      return {
        tone: 'casual',
        averageLength: 50,
        commonPhrases: [],
        emojiUsage: 'none' as const,
        typingPatterns: 'casual',
        styleGuide: 'Keep messages brief and casual.'
      }
    }

    // Calculate average message length
    const totalLength = recentMessages.reduce((sum, m) => sum + m.text.length, 0)
    const avgLength = Math.round(totalLength / recentMessages.length)

    // Detect emoji usage
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
    const messagesWithEmoji = recentMessages.filter(m => emojiRegex.test(m.text))
    const emojiPercentage = messagesWithEmoji.length / recentMessages.length

    let emojiUsage: 'none' | 'rare' | 'frequent'
    if (emojiPercentage === 0) {
      emojiUsage = 'none'
    } else if (emojiPercentage < 0.3) {
      emojiUsage = 'rare'
    } else {
      emojiUsage = 'frequent'
    }

    // Detect capitalization and punctuation patterns
    const properCaps = recentMessages.filter(m => /^[A-Z]/.test(m.text)).length
    const capsPercentage = properCaps / recentMessages.length

    const withPunctuation = recentMessages.filter(m => /[.!?]$/.test(m.text)).length
    const punctuationPercentage = withPunctuation / recentMessages.length

    let typingPatterns: string
    if (capsPercentage > 0.7 && punctuationPercentage > 0.7) {
      typingPatterns = 'Proper capitalization and punctuation'
    } else if (capsPercentage < 0.3) {
      typingPatterns = 'Mostly lowercase, casual typing'
    } else {
      typingPatterns = 'Mixed capitalization, casual style'
    }

    // Extract common words/phrases (simple frequency analysis)
    const allText = recentMessages.map(m => m.text.toLowerCase()).join(' ')
    const words = allText.split(/\s+/).filter(w => w.length > 3)
    const wordFreq = new Map<string, number>()

    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }

    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)

    // Determine tone based on length and patterns
    let tone: string
    if (avgLength < 30) {
      tone = 'very brief and casual'
    } else if (avgLength < 80) {
      tone = 'casual and conversational'
    } else {
      tone = 'detailed and expressive'
    }

    // Create comprehensive style guide
    const styleGuide = `
Writing Style Analysis:
- Message length: ${avgLength < 30 ? 'Very brief (under 30 chars)' : avgLength < 80 ? 'Moderate (30-80 chars)' : 'Longer messages (80+ chars)'}
- Average: ${avgLength} characters
- Tone: ${tone}
- Capitalization: ${typingPatterns}
- Emoji usage: ${emojiUsage}
- Common words: ${sortedWords.slice(0, 5).join(', ')}

When mimicking this user:
1. Keep messages around ${avgLength} characters (±20%)
2. ${capsPercentage < 0.3 ? 'Use mostly lowercase' : capsPercentage > 0.7 ? 'Use proper capitalization' : 'Mix capitalization naturally'}
3. ${punctuationPercentage < 0.3 ? 'Skip punctuation usually' : punctuationPercentage > 0.7 ? 'Use proper punctuation' : 'Use punctuation sparingly'}
4. ${emojiUsage === 'none' ? 'Avoid emojis' : emojiUsage === 'rare' ? 'Use emojis occasionally' : 'Use emojis frequently'}
5. Match the ${tone} tone
    `.trim()

    return {
      tone,
      averageLength: avgLength,
      commonPhrases: sortedWords,
      emojiUsage,
      typingPatterns,
      styleGuide
    }
  }
})
