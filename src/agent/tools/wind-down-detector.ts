/**
 * Wind-Down Detector Tool - Determines when to gracefully exit conversation
 */

import { createTool } from '@mastra/core'
import { z } from 'zod'

export const windDownDetectorTool = createTool({
  id: 'detect-wind-down',
  description: "Analyzes conversation to determine if it's time to wind down and exit gracefully.",
  inputSchema: z.object({
    conversationHistory: z.array(z.object({
      sender: z.string(),
      text: z.string()
    })),
    messagesSent: z.number(),
    maxMessages: z.number().default(3)
  }),
  outputSchema: z.object({
    shouldWindDown: z.boolean(),
    reason: z.string(),
    suggestedExitMessage: z.string()
  }),
  execute: async ({ context }) => {
    const { conversationHistory, messagesSent, maxMessages } = context

    // Check if we've hit the message limit
    if (messagesSent >= maxMessages) {
      return {
        shouldWindDown: true,
        reason: `Sent ${messagesSent} messages, reaching the maximum of ${maxMessages}`,
        suggestedExitMessage: 'anyway i gotta run but talk soon!'
      }
    }

    // Analyze recent messages for natural conclusion points
    const recentMessages = conversationHistory.slice(-3)
    const lastMessage = recentMessages[recentMessages.length - 1]

    // Check for natural wind-down indicators
    const windDownIndicators = [
      'gotta go',
      'talk later',
      'bye',
      'see you',
      'ttyl',
      'ok cool',
      'sounds good',
      'alright',
      'perfect'
    ]

    if (lastMessage && windDownIndicators.some(indicator =>
      lastMessage.text.toLowerCase().includes(indicator)
    )) {
      return {
        shouldWindDown: true,
        reason: 'Friend indicated natural conclusion',
        suggestedExitMessage: 'cool talk soon!'
      }
    }

    // If approaching limit, suggest wind down
    if (messagesSent >= maxMessages - 1) {
      return {
        shouldWindDown: true,
        reason: `Approaching message limit (${messagesSent}/${maxMessages})`,
        suggestedExitMessage: 'anyway gotta go, catch you later'
      }
    }

    return {
      shouldWindDown: false,
      reason: 'Conversation can continue',
      suggestedExitMessage: ''
    }
  }
})
