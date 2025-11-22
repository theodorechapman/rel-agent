/**
 * ConversationTracker - Manages state for all active conversations
 * Tracks message history, timestamps, and agent activation status
 */

import type { Message } from '@photon-ai/imessage-kit'
import type { ConversationState } from '../types/index.js'

export class ConversationTracker {
  private conversations: Map<string, ConversationState> = new Map()
  private debug: boolean

  constructor(debug: boolean = false) {
    this.debug = debug
  }

  /**
   * Update tracking when user sends an outgoing message
   */
  updateOutgoingMessage(chatId: string, message: Message, isAgentMessage = false): void {
    const conv = this.getOrCreateConversation(chatId)

    // Always update timestamp (fixes inactivity loop bug)
    conv.lastOutgoingTimestamp = message.date

    // Only add to user history if it's not an agent message
    if (!isAgentMessage) {
      conv.userMessageHistory.push(message)
    }

    // If user responds while agent is active, deactivate the agent
    // But don't deactivate if the agent itself sent the message
    if (conv.isAgentActive && !isAgentMessage) {
      if (this.debug) {
        console.log(`[Tracker] User took back control in ${chatId}`)
      }
      conv.isAgentActive = false
      conv.messagesSent = 0
    }

    // Reset approval state only if user sent the message
    if (!isAgentMessage) {
      conv.awaitingApproval = false
    }

    this.conversations.set(chatId, conv)

    if (this.debug) {
      console.log(`[Tracker] Updated outgoing: ${chatId}${isAgentMessage ? ' (agent)' : ''}`)
    }
  }

  /**
   * Update tracking when friend sends an incoming message
   */
  updateIncomingMessage(chatId: string, message: Message): void {
    const conv = this.getOrCreateConversation(chatId)

    conv.lastIncomingTimestamp = message.date
    conv.conversationHistory.push(message)

    this.conversations.set(chatId, conv)

    if (this.debug) {
      console.log(`[Tracker] Updated incoming: ${chatId}`)
    }
  }

  /**
   * Get conversations that have been inactive for longer than threshold
   */
  getInactiveConversations(thresholdMs: number, maxInactivityMs: number, userIdentifier?: string): ConversationState[] {
    const now = Date.now()
    const inactive: ConversationState[] = []

    for (const conv of this.conversations.values()) {
      // Skip user's own conversation (messages to self)
      if (userIdentifier && conv.chatId === userIdentifier) {
        continue
      }

      const inactivityMs = now - conv.lastOutgoingTimestamp.getTime()

      // Skip if agent is already active or waiting for approval
      if (conv.isAgentActive || conv.awaitingApproval) {
        continue
      }

      // Only trigger if inactivity is within range
      if (inactivityMs >= thresholdMs && inactivityMs <= maxInactivityMs) {
        // Only trigger if there was a recent incoming message (friend is expecting reply)
        if (conv.lastIncomingTimestamp) {
          const timeSinceIncoming = now - conv.lastIncomingTimestamp.getTime()
          // Friend message should be recent (within 5 minutes)
          if (timeSinceIncoming < 300000) {
            // Double-check state before adding (extra safeguard against race conditions)
            if (!conv.isAgentActive && !conv.awaitingApproval) {
              inactive.push(conv)
            }
          }
        }
      }
    }

    return inactive
  }

  /**
   * Mark a conversation as waiting for user approval
   */
  markAwaitingApproval(chatId: string): void {
    const conv = this.conversations.get(chatId)
    if (conv) {
      conv.awaitingApproval = true
      this.conversations.set(chatId, conv)

      if (this.debug) {
        console.log(`[Tracker] Marked awaiting approval: ${chatId}`)
      }
    }
  }

  /**
   * Mark the agent as active in a conversation
   */
  markAgentActive(chatId: string): void {
    const conv = this.conversations.get(chatId)
    if (conv) {
      conv.isAgentActive = true
      conv.awaitingApproval = false
      conv.messagesSent = 0

      if (this.debug) {
        console.log(`[Tracker] Agent activated: ${chatId}`)
      }
    }
  }

  /**
   * Mark the agent as inactive in a conversation
   */
  markAgentInactive(chatId: string): void {
    const conv = this.conversations.get(chatId)
    if (conv) {
      conv.isAgentActive = false
      conv.messagesSent = 0
      conv.lastAgentDeactivationTime = new Date() // Track when agent was deactivated

      if (this.debug) {
        console.log(`[Tracker] Agent deactivated: ${chatId}`)
      }
    }
  }

  /**
   * Increment the message count for an agent session
   */
  incrementMessageCount(chatId: string): void {
    const conv = this.conversations.get(chatId)
    if (conv) {
      conv.messagesSent++
      this.conversations.set(chatId, conv)
    }
  }

  /**
   * Reset a conversation (clear approval state, deactivate agent)
   */
  resetConversation(chatId: string): void {
    const conv = this.conversations.get(chatId)
    if (conv) {
      conv.isAgentActive = false
      conv.awaitingApproval = false
      conv.messagesSent = 0
      this.conversations.set(chatId, conv)

      if (this.debug) {
        console.log(`[Tracker] Reset conversation: ${chatId}`)
      }
    }
  }

  /**
   * Get user's message history for style analysis
   */
  getUserMessageHistory(chatId: string, limit: number): Message[] {
    const conv = this.conversations.get(chatId)
    if (!conv) return []

    return conv.userMessageHistory.slice(-limit)
  }

  /**
   * Get conversation history with friend
   */
  getConversationHistory(chatId: string, limit: number): Message[] {
    const conv = this.conversations.get(chatId)
    if (!conv) return []

    return conv.conversationHistory.slice(-limit)
  }

  /**
   * Get a specific conversation state
   */
  getConversation(chatId: string): ConversationState | undefined {
    return this.conversations.get(chatId)
  }

  /**
   * Get all tracked conversations
   */
  getAllConversations(): ConversationState[] {
    return Array.from(this.conversations.values())
  }

  /**
   * Update friend name for a conversation
   */
  setFriendName(chatId: string, friendName: string): void {
    const conv = this.conversations.get(chatId)
    if (conv) {
      conv.friendName = friendName
      this.conversations.set(chatId, conv)
    }
  }

  /**
   * Create or get existing conversation state
   */
  private getOrCreateConversation(chatId: string): ConversationState {
    let conv = this.conversations.get(chatId)

    if (!conv) {
      conv = {
        chatId,
        friendName: 'your friend',
        lastOutgoingTimestamp: new Date(),
        lastIncomingTimestamp: null,
        isAgentActive: false,
        awaitingApproval: false,
        messagesSent: 0,
        lastAgentDeactivationTime: null,
        userMessageHistory: [],
        conversationHistory: []
      }
      this.conversations.set(chatId, conv)

      if (this.debug) {
        console.log(`[Tracker] Created new conversation: ${chatId}`)
      }
    }

    return conv
  }
}
