/**
 * Core type definitions for the Relationship Agent
 */

import type { Message } from '@photon-ai/imessage-kit'

/**
 * Represents the state of a conversation being tracked
 */
export interface ConversationState {
  /** Unique identifier for the chat */
  chatId: string

  /** Display name of the friend/contact */
  friendName: string

  /** Timestamp of the last outgoing message from the user */
  lastOutgoingTimestamp: Date

  /** Timestamp of the last incoming message from the friend */
  lastIncomingTimestamp: Date | null

  /** Whether the agent is currently active in this conversation */
  isAgentActive: boolean

  /** Whether we're waiting for user approval to activate the agent */
  awaitingApproval: boolean

  /** Number of messages the agent has sent in this session */
  messagesSent: number

  /** Timestamp of when the agent was last deactivated (for re-activation logic) */
  lastAgentDeactivationTime: Date | null

  /** History of user's messages from this conversation */
  userMessageHistory: Message[]

  /** Recent conversation history with the friend */
  conversationHistory: Message[]
}

/**
 * Configuration for the agent behavior
 */
export interface AgentConfig {
  /** Milliseconds of inactivity before prompting to take over (default: 120000 = 2 minutes) */
  inactivityThresholdMs: number

  /** Maximum number of messages the agent should send before winding down */
  maxMessagesToSend: number

  /** Number of recent user messages to analyze for style (default: 50) */
  styleAnalysisCount: number

  /** Keywords that indicate user approval */
  approvalKeywords: string[]

  /** Interval for checking inactivity (default: 30000 = 30 seconds) */
  timerCheckIntervalMs: number

  /** Maximum inactivity time before giving up (default: 3600000 = 1 hour) */
  maxInactivityMs: number

  /** Timeout for waiting for friend's response (default: 60000 = 1 minute) */
  responseTimeoutMs: number

  /** User's own identifier (phone number or iMessage ID) */
  userIdentifier: string

  /** Cerebras API key */
  cerebrasApiKey: string

  /** Debug mode */
  debug: boolean
}

/**
 * Result from style analysis
 */
export interface StyleAnalysis {
  /** Detected tone of the user's messages */
  tone: string

  /** Average message length in characters */
  averageLength: number

  /** Common phrases/words used by the user */
  commonPhrases: string[]

  /** Emoji usage pattern: none, rare, frequent */
  emojiUsage: 'none' | 'rare' | 'frequent'

  /** Typing patterns description */
  typingPatterns: string

  /** Comprehensive style guide for the LLM */
  styleGuide: string
}

/**
 * Result from message generation
 */
export interface MessageGenerationResult {
  /** The generated message text */
  message: string

  /** Whether the conversation should continue */
  shouldContinue: boolean

  /** Reasoning for the message generation */
  reasoning: string
}

/**
 * Result from wind-down detection
 */
export interface WindDownResult {
  /** Whether it's time to wind down the conversation */
  shouldWindDown: boolean

  /** Reason for the decision */
  reason: string

  /** Suggested exit message */
  suggestedExitMessage: string
}

/**
 * Event emitted when the agent state changes
 */
export interface AgentEvent {
  type: 'activation' | 'deactivation' | 'message_sent' | 'wind_down' | 'error'
  chatId: string
  timestamp: Date
  data?: any
}
