/**
 * Agent Core - Main logic for agent activation and conversation management
 * 
 * Uses event-driven response handling: when the agent sends a message,
 * it returns immediately. The incoming message handler in index.ts
 * detects friend responses and triggers the next agent message.
 */

import type { IMessageSDK, Message } from '@photon-ai/imessage-kit'
import type { ConversationState, AgentConfig } from '../types/index.js'
import type { ConversationTracker } from '../watchers/conversation-tracker.js'
import { relationshipAgent } from '../agent/relationship-agent.js'

/** 5 minutes in milliseconds - the AI control window */
export const AI_CONTROL_WINDOW_MS = 300000

/**
 * Get friend's display name from chat
 */
export async function getFriendName(sdk: IMessageSDK, chatId: string): Promise<string> {
  try {
    const chats = await sdk.listChats({ limit: 100 })
    const chat = chats.find(c => c.chatId === chatId)

    if (chat && chat.displayName) {
      return chat.displayName
    }

    // Fallback
    return 'your friend'
  } catch (error) {
    console.error('[AgentCore] Error getting friend name:', error)
    return 'your friend'
  }
}

/**
 * Send the takeover prompt to the user
 */
export async function sendTakeoverPrompt(
  sdk: IMessageSDK,
  tracker: ConversationTracker,
  conv: ConversationState,
  config: AgentConfig
): Promise<void> {
  // Double-check: don't send if agent is already active or awaiting approval
  if (conv.isAgentActive || conv.awaitingApproval) {
    if (config.debug) {
      console.log(`[AgentCore] Skipping takeover prompt for ${conv.chatId} (already active or awaiting)`)
    }
    return
  }

  const friendName = await getFriendName(sdk, conv.chatId)

  // Update friend name in tracker
  tracker.setFriendName(conv.chatId, friendName)

  const promptMessage = `Hey, are you trying to ghost ${friendName} or do you want me to take over?`

  try {
    // Mark as waiting for approval FIRST to prevent race conditions
    tracker.markAwaitingApproval(conv.chatId)

    // Then send to user's own identifier
    await sdk.send(config.userIdentifier, promptMessage)

    if (config.debug) {
      console.log(`[AgentCore] Sent takeover prompt for ${friendName}`)
    }
  } catch (error) {
    console.error('[AgentCore] Error sending takeover prompt:', error)
    // If send fails, reset the awaiting approval state
    tracker.resetConversation(conv.chatId)
  }
}

/**
 * Activate agent and send ONE message
 * Returns immediately after sending - the incoming message handler
 * will trigger the next message when the friend responds.
 * 
 * @param isInitialActivation - true if this is the first activation (resets counters)
 */
export async function activateAgent(
  sdk: IMessageSDK,
  tracker: ConversationTracker,
  conv: ConversationState,
  config: AgentConfig,
  isInitialActivation: boolean = true
): Promise<void> {
  try {
    // Mark agent as active
    tracker.markAgentActive(conv.chatId, isInitialActivation)

    if (config.debug) {
      if (isInitialActivation) {
        console.log(`\n[AgentCore] 🤖 Agent activated for ${conv.friendName}`)
      } else {
        console.log(`\n[AgentCore] 🤖 Agent continuing conversation with ${conv.friendName}`)
      }
    }

    // Get fresh conversation state
    const currentConv = tracker.getConversation(conv.chatId)
    if (!currentConv) {
      console.error('[AgentCore] Conversation not found after activation')
      return
    }

    // Check if we've hit the message limit
    if (currentConv.messagesSent >= config.maxMessagesToSend) {
      if (config.debug) {
        console.log(`[AgentCore] Reached message limit (${currentConv.messagesSent}/${config.maxMessagesToSend}), sending wind-down`)
      }

      // Get user's message history for style
      const userMessages = tracker.getUserMessageHistory(conv.chatId, config.styleAnalysisCount)
      await sendWindDownMessage(sdk, tracker, currentConv, userMessages, config)
      tracker.markAgentInactive(conv.chatId)
      return
    }

    // Get user's message history for style analysis
    const userMessages = tracker.getUserMessageHistory(
      conv.chatId,
      config.styleAnalysisCount
    )

    // Get conversation history with friend
    const conversationHistory = tracker.getConversationHistory(conv.chatId, 20)

    // Send ONE message
    await sendAgentMessage(sdk, tracker, currentConv, userMessages, conversationHistory, config)

  } catch (error) {
    console.error(`[AgentCore] Error in agent for ${conv.chatId}:`, error)

    // Notify user of error
    try {
      await sdk.send(
        config.userIdentifier,
        `⚠️ Agent encountered an error with ${conv.friendName}. Taking back control.`
      )
    } catch (notifyError) {
      console.error('[AgentCore] Error sending error notification:', notifyError)
    }

    // Deactivate agent
    tracker.markAgentInactive(conv.chatId)
  }
}

/**
 * Send a single agent message
 * Does NOT wait for response - returns immediately after sending
 */
async function sendAgentMessage(
  sdk: IMessageSDK,
  tracker: ConversationTracker,
  conv: ConversationState,
  userMessages: Message[],
  conversationHistory: Message[],
  config: AgentConfig
): Promise<void> {
  // Prepare conversation context for agent
  const recentHistory = conversationHistory.slice(-10)
  const historyText = recentHistory
    .map(m => `${m.isFromMe ? 'You' : conv.friendName}: ${m.text || '(attachment)'}`)
    .join('\n')

  const userMessagesForStyle = userMessages.map(m => ({
    text: m.text || '',
    date: m.date.toISOString()
  }))

  const messagesSent = conv.messagesSent

  // Build context for agent
  const context = `
Current situation:
- You are texting with ${conv.friendName}
- You have sent ${messagesSent} messages so far in this session
- Maximum messages before wind-down: ${config.maxMessagesToSend}

Recent conversation:
${historyText}

Your writing style (from ${userMessages.length} message samples):
First, analyze these messages to understand your style, then respond to ${conv.friendName}'s last message.

User message samples for style analysis:
${userMessagesForStyle.slice(-15).map(m => m.text).join('\n')}

Instructions:
${messagesSent >= config.maxMessagesToSend - 1
  ? 'This should be your LAST message - wind down gracefully and naturally in your style.'
  : 'Generate ONE natural response to the last message from ' + conv.friendName + '. Keep it in your exact texting style.'
}

Respond with ONLY the message text you want to send - no explanations, no quotes, just the raw message as you would type it.
`

  if (config.debug) {
    console.log(`[AgentCore] Generating message ${messagesSent + 1}/${config.maxMessagesToSend}...`)
  }

  const response = await relationshipAgent.generate(context)

  let messageText = response.text?.trim() || ''

  // Clean up response (remove quotes, explanations, etc.)
  messageText = cleanupAgentResponse(messageText)

  if (!messageText) {
    console.error('[AgentCore] Agent generated empty message, deactivating')
    tracker.markAgentInactive(conv.chatId)
    return
  }

  if (config.debug) {
    console.log(`[AgentCore] 📤 Sending: "${messageText}"`)
  }

  // Send message to friend
  await sdk.send(conv.chatId, messageText)

  // Update tracker
  tracker.incrementMessageCount(conv.chatId)

  // Check if this was the last message (hit limit)
  const updatedConv = tracker.getConversation(conv.chatId)
  if (updatedConv && updatedConv.messagesSent >= config.maxMessagesToSend) {
    if (config.debug) {
      console.log('[AgentCore] ✅ Reached message limit, deactivating agent')
    }
    tracker.markAgentInactive(conv.chatId)
  } else {
    if (config.debug) {
      console.log(`[AgentCore] ⏳ Waiting for ${conv.friendName}'s response (event-driven)...`)
    }
  }
}

/**
 * Send a natural wind-down message
 */
async function sendWindDownMessage(
  sdk: IMessageSDK,
  tracker: ConversationTracker,
  conv: ConversationState,
  userMessages: Message[],
  config: AgentConfig
): Promise<void> {
  try {
    const userMessagesForStyle = userMessages.map(m => ({
      text: m.text || '',
      date: m.date.toISOString()
    }))

    const windDownPrompt = `
Based on these sample messages showing your texting style:
${userMessagesForStyle.slice(-10).map(m => m.text).join('\n')}

Generate ONE brief, natural exit message to end the conversation with ${conv.friendName}.
Match your style exactly - same length, tone, capitalization, and punctuation patterns.

Examples (adjust to YOUR style):
- If casual/brief: "gtg talk later"
- If casual: "gotta run but talk soon!"
- If proper: "I need to go, but let's chat later!"

Respond with ONLY the exit message - no explanations, no quotes.
`

    const response = await relationshipAgent.generate(windDownPrompt)
    let windDownText = response.text?.trim() || 'gotta go, talk later!'

    // Clean up response
    windDownText = cleanupAgentResponse(windDownText)

    if (config.debug) {
      console.log(`[AgentCore] 👋 Wind-down: "${windDownText}"`)
    }

    await sdk.send(conv.chatId, windDownText)

  } catch (error) {
    console.error('[AgentCore] Error sending wind-down message:', error)
  }
}

/**
 * Clean up agent response (remove quotes, explanations, etc.)
 */
function cleanupAgentResponse(text: string): string {
  let cleaned = text.trim()

  // Remove surrounding quotes
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1)
  }

  // Remove "Here's my response:" type prefixes
  const prefixes = [
    /^here'?s? (my|the|a) (message|response|reply):?\s*/i,
    /^(message|response|reply):?\s*/i,
    /^i would (say|respond|text):?\s*/i
  ]

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '')
  }

  return cleaned.trim()
}
