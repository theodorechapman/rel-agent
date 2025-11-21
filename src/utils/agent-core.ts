/**
 * Agent Core - Main logic for agent activation and conversation management
 */

import type { IMessageSDK, Message } from '@photon-ai/imessage-kit'
import type { ConversationState, AgentConfig } from '../types/index.js'
import type { ConversationTracker } from '../watchers/conversation-tracker.js'
import { relationshipAgent } from '../agent/relationship-agent.js'

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
  const friendName = await getFriendName(sdk, conv.chatId)

  // Update friend name in tracker
  tracker.setFriendName(conv.chatId, friendName)

  const promptMessage = `Hey, are you trying to ghost ${friendName} or do you want me to take over?`

  try {
    // Send to user's own identifier
    await sdk.send(config.userIdentifier, promptMessage)

    // Mark as waiting for approval
    tracker.markAwaitingApproval(conv.chatId)

    if (config.debug) {
      console.log(`[AgentCore] Sent takeover prompt for ${friendName}`)
    }
  } catch (error) {
    console.error('[AgentCore] Error sending takeover prompt:', error)
  }
}

/**
 * Wait for a response from the friend with timeout
 */
export async function waitForResponse(
  sdk: IMessageSDK,
  chatId: string,
  timeoutMs: number,
  tracker: ConversationTracker
): Promise<Message | null> {
  return new Promise((resolve) => {
    const startTime = Date.now()

    // Get the current conversation history to track what we've already seen
    const initialHistory = tracker.getConversationHistory(chatId, 10)
    const initialMessageCount = initialHistory.length

    const timeout = setTimeout(() => {
      clearInterval(checkInterval)
      resolve(null)
    }, timeoutMs)

    // Poll for new messages
    const checkInterval = setInterval(async () => {
      // Check if agent is still active (user might have taken over)
      const conv = tracker.getConversation(chatId)
      if (!conv || !conv.isAgentActive) {
        clearInterval(checkInterval)
        clearTimeout(timeout)
        resolve(null)
        return
      }

      // Check for new messages in conversation history
      const currentHistory = tracker.getConversationHistory(chatId, 10)

      // If we have more messages than before, check the new ones
      if (currentHistory.length > initialMessageCount) {
        const newMessages = currentHistory.slice(initialMessageCount)

        // Look for incoming messages (not from me) that arrived after we started waiting
        const newIncoming = newMessages.find(m =>
          !m.isFromMe && m.date.getTime() >= startTime
        )

        if (newIncoming) {
          clearInterval(checkInterval)
          clearTimeout(timeout)
          resolve(newIncoming)
        }
      }
    }, 2000) // Check every 2 seconds
  })
}

/**
 * Activate agent and run conversation
 */
export async function activateAgent(
  sdk: IMessageSDK,
  tracker: ConversationTracker,
  conv: ConversationState,
  config: AgentConfig
): Promise<void> {
  try {
    // Mark agent as active
    tracker.markAgentActive(conv.chatId)

    if (config.debug) {
      console.log(`\n[AgentCore] 🤖 Agent activated for ${conv.friendName}`)
    }

    // Get user's message history for style analysis
    const userMessages = tracker.getUserMessageHistory(
      conv.chatId,
      config.styleAnalysisCount
    )

    // Get conversation history with friend
    const conversationHistory = tracker.getConversationHistory(conv.chatId, 20)

    // Run conversation loop
    await runAgentConversation(sdk, tracker, conv, userMessages, conversationHistory, config)

  } catch (error) {
    console.error(`[AgentCore] Error activating agent for ${conv.chatId}:`, error)

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
 * Main conversation loop
 */
async function runAgentConversation(
  sdk: IMessageSDK,
  tracker: ConversationTracker,
  conv: ConversationState,
  userMessages: Message[],
  conversationHistory: Message[],
  config: AgentConfig
): Promise<void> {
  let messagesSent = 0

  while (messagesSent < config.maxMessagesToSend) {
    // Check if user took back control
    const currentConv = tracker.getConversation(conv.chatId)
    if (!currentConv || !currentConv.isAgentActive) {
      if (config.debug) {
        console.log('[AgentCore] User took back control, stopping agent')
      }
      return
    }

    // Prepare conversation context for agent
    const recentHistory = conversationHistory.slice(-10)
    const historyText = recentHistory
      .map(m => `${m.isFromMe ? 'You' : conv.friendName}: ${m.text || '(attachment)'}`)
      .join('\n')

    const userMessagesForStyle = userMessages.map(m => ({
      text: m.text || '',
      date: m.date.toISOString()
    }))

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

    try {
      // Generate response using agent
      if (config.debug) {
        console.log(`\n[AgentCore] Generating message ${messagesSent + 1}/${config.maxMessagesToSend}...`)
      }

      const response = await relationshipAgent.generate(context)

      let messageText = response.text?.trim() || ''

      // Clean up response (remove quotes, explanations, etc.)
      messageText = cleanupAgentResponse(messageText)

      if (!messageText) {
        console.error('[AgentCore] Agent generated empty message, stopping')
        break
      }

      if (config.debug) {
        console.log(`[AgentCore] 📤 Sending: "${messageText}"`)
      }

      // Send message to friend
      await sdk.send(conv.chatId, messageText)

      // Update tracker
      messagesSent++
      tracker.incrementMessageCount(conv.chatId)

      // Check if should wind down
      if (messagesSent >= config.maxMessagesToSend) {
        if (config.debug) {
          console.log('[AgentCore] Reached message limit, winding down')
        }
        break
      }

      // Wait for friend's response
      if (config.debug) {
        console.log(`[AgentCore] ⏳ Waiting for ${conv.friendName}'s response...`)
      }

      const friendResponse = await waitForResponse(
        sdk,
        conv.chatId,
        config.responseTimeoutMs,
        tracker
      )

      if (!friendResponse) {
        if (config.debug) {
          console.log('[AgentCore] No response from friend, winding down')
        }

        // Send wind-down message
        await sendWindDownMessage(sdk, tracker, conv, userMessages, config)
        break
      }

      if (config.debug) {
        console.log(`[AgentCore] 📨 Received: "${friendResponse.text || '(attachment)'}"`)
      }

      // Add friend's response to history
      conversationHistory.push(friendResponse)

      // Small delay to seem natural
      await new Promise(resolve => setTimeout(resolve, 2000))

    } catch (error) {
      console.error('[AgentCore] Error in conversation loop:', error)
      break
    }
  }

  // Deactivate agent
  tracker.markAgentInactive(conv.chatId)

  if (config.debug) {
    console.log(`[AgentCore] ✅ Agent session complete for ${conv.friendName}\n`)
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
