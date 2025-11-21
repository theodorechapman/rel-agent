/**
 * Message Generator Tool - Generates contextually appropriate messages in user's style
 */

import { createTool } from '@mastra/core'
import { z } from 'zod'

export const messageGeneratorTool = createTool({
  id: 'generate-message',
  description: "Generates a message in the user's style based on conversation context and style analysis.",
  inputSchema: z.object({
    conversationHistory: z.array(z.object({
      sender: z.string(),
      text: z.string(),
      timestamp: z.string()
    })),
    styleGuide: z.string(),
    friendName: z.string(),
    messagesSentSoFar: z.number()
  }),
  outputSchema: z.object({
    message: z.string(),
    shouldContinue: z.boolean(),
    reasoning: z.string()
  }),
  execute: async ({ context }) => {
    const { conversationHistory, styleGuide, friendName, messagesSentSoFar } = context

    // This tool defines the schema, but the actual message generation
    // happens through the agent's LLM call with proper prompting
    // This is a placeholder that should not be directly called

    return {
      message: '',
      shouldContinue: messagesSentSoFar < 2,
      reasoning: 'Tool schema definition only'
    }
  }
})
