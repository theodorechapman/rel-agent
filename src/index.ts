/**
 * Relationship Agent - Main Application Entry Point
 *
 * Monitors iMessage conversations, detects inactivity, and offers to take over
 * conversations in the user's style using AI.
 */

import { IMessageSDK } from '@photon-ai/imessage-kit'
import { ConversationTracker } from './watchers/conversation-tracker.js'
import { TimerManager } from './utils/timer-manager.js'
import { parseUserResponse } from './utils/approval-parser.js'
import { sendTakeoverPrompt, activateAgent } from './utils/agent-core.js'
import type { AgentConfig } from './types/index.js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

/**
 * Load configuration from environment variables
 */
function loadConfig(): AgentConfig {
  return {
    inactivityThresholdMs: parseInt(process.env.INACTIVITY_THRESHOLD_MS || '120000'),
    maxMessagesToSend: parseInt(process.env.MAX_AGENT_MESSAGES || '3'),
    styleAnalysisCount: parseInt(process.env.STYLE_ANALYSIS_MESSAGE_COUNT || '50'),
    approvalKeywords: ['take over', 'yes', 'sure', 'ok'],
    timerCheckIntervalMs: parseInt(process.env.TIMER_CHECK_INTERVAL_MS || '30000'),
    maxInactivityMs: parseInt(process.env.MAX_INACTIVITY_MS || '3600000'),
    responseTimeoutMs: parseInt(process.env.RESPONSE_TIMEOUT_MS || '60000'),
    userIdentifier: process.env.USER_IDENTIFIER || '',
    cerebrasApiKey: process.env.CEREBRAS_API_KEY || '',
    debug: process.env.DEBUG === 'true'
  }
}

async function main() {
  console.log('🤖 Relationship Agent Starting...\n')

  // Load configuration
  const config = loadConfig()

  // Validate configuration
  if (!config.cerebrasApiKey || config.cerebrasApiKey === 'your-key-here') {
    console.error('❌ Error: CEREBRAS_API_KEY not set in .env file')
    console.error('Please add your Cerebras API key to the .env file')
    process.exit(1)
  }

  if (!config.userIdentifier || config.userIdentifier === '+1234567890') {
    console.warn('⚠️  Warning: USER_IDENTIFIER not properly set in .env file')
    console.warn('You may not receive takeover prompts. Please set your phone number or iMessage ID.')
  }

  // Initialize components
  const tracker = new ConversationTracker(config.debug)
  const timerManager = new TimerManager()

  // Initialize iMessage SDK
  const sdk = new IMessageSDK({
    debug: false, // Keep SDK quiet to reduce noise
    watcher: {
      pollInterval: 2000,
      unreadOnly: false,
      excludeOwnMessages: false // Need to track both incoming and outgoing
    }
  })

  console.log('Configuration:')
  console.log(`  - Inactivity threshold: ${config.inactivityThresholdMs / 1000}s`)
  console.log(`  - Max messages per session: ${config.maxMessagesToSend}`)
  console.log(`  - Check interval: ${config.timerCheckIntervalMs / 1000}s`)
  console.log(`  - Debug mode: ${config.debug}\n`)

  try {
    // Start watching for messages
    await sdk.startWatching({
      onMessage: async (message) => {
        try {
          if (message.isFromMe) {
            // Check if agent is active for this conversation
            const conv = tracker.getConversation(message.chatId)

            // If agent is active, this is an agent-sent message
            if (conv?.isAgentActive) {
              // Update timestamp but mark as agent message (fixes inactivity loop)
              tracker.updateOutgoingMessage(message.chatId, message, true)

              if (config.debug) {
                console.log(`[Main] Agent-sent message to ${message.chatId}`)
              }
              return
            }

            // User sent a message
            tracker.updateOutgoingMessage(message.chatId, message, false)

            // Check if this is a response to our takeover prompt
            // User responds to themselves (USER_IDENTIFIER), so check ALL conversations
            const allConversations = tracker.getAllConversations()
            const awaitingConv = allConversations.find(c => c.awaitingApproval)

            if (awaitingConv && message.chatId === config.userIdentifier) {
              // Ignore the prompt message itself (it contains "take over" which would trigger approval)
              const messageText = message.text || ''
              // More robust check: ignore if it contains the full prompt pattern OR is too similar
              if (messageText.includes('are you trying to ghost') ||
                  messageText.includes('do you want me to take over?')) {
                if (config.debug) {
                  console.log('[Main] Ignoring takeover prompt echo')
                }
                return
              }

              const response = parseUserResponse(messageText)

              if (response === 'approve') {
                // Check if agent is already active (prevent duplicate activation)
                if (awaitingConv.isAgentActive) {
                  if (config.debug) {
                    console.log(`[Main] Agent already active for ${awaitingConv.friendName}, ignoring approval`)
                  }
                  return
                }

                if (config.debug) {
                  console.log(`\n[Main] ✅ User approved takeover for ${awaitingConv.friendName}`)
                }

                // Activate agent
                await activateAgent(sdk, tracker, awaitingConv, config)

              } else if (response === 'deny') {
                if (config.debug) {
                  console.log(`\n[Main] ❌ User denied takeover for ${awaitingConv.friendName}`)
                }

                // Reset conversation
                tracker.resetConversation(awaitingConv.chatId)
              }
            }

          } else {
            // Friend sent a message
            tracker.updateIncomingMessage(message.chatId, message)

            if (config.debug) {
              console.log(`\n[Main] 📨 Message from ${message.senderName || message.sender}`)
            }

            // Check if agent was recently active in this conversation
            const conv = tracker.getConversation(message.chatId)
            if (conv && conv.lastAgentDeactivationTime && !conv.isAgentActive && !conv.awaitingApproval) {
              const timeSinceDeactivation = Date.now() - conv.lastAgentDeactivationTime.getTime()
              // If agent was deactivated within last 5 minutes, reactivate after 5 seconds
              if (timeSinceDeactivation < 300000) { // 5 minutes
                if (config.debug) {
                  console.log(`[Main] Friend responded ${Math.round(timeSinceDeactivation / 1000)}s after agent deactivation`)
                  console.log('[Main] ⏳ Waiting 5 seconds before reactivating agent...')
                }

                // Wait 5 seconds before reactivating
                setTimeout(async () => {
                  // Double-check that user hasn't taken over in the meantime
                  const currentConv = tracker.getConversation(message.chatId)
                  if (currentConv && !currentConv.isAgentActive && !currentConv.awaitingApproval) {
                    try {
                      if (config.debug) {
                        console.log(`[Main] 🤖 Auto-reactivating agent for ${currentConv.friendName}`)
                      }
                      await activateAgent(sdk, tracker, currentConv, config)
                    } catch (error) {
                      console.error('[Main] Error reactivating agent:', error)
                    }
                  }
                }, 5000) // 5 second delay
              }
            }
          }
        } catch (error) {
          console.error('[Main] Error handling message:', error)
        }
      },

      onError: (error) => {
        console.error('[Main] Watcher error:', error)
      }
    })

    console.log('✅ Message watcher started')

    // Start inactivity timer
    timerManager.startInactivityCheck(
      config.timerCheckIntervalMs,
      config.inactivityThresholdMs,
      config.maxInactivityMs,
      tracker,
      async (conv) => {
        try {
          if (config.debug) {
            console.log(`\n[Main] ⏰ Detected inactivity in conversation with ${conv.friendName}`)
          }

          await sendTakeoverPrompt(sdk, tracker, conv, config)
        } catch (error) {
          console.error('[Main] Error sending takeover prompt:', error)
        }
      },
      config.userIdentifier
    )

    console.log('✅ Inactivity timer started')
    console.log('\n👀 Watching for inactive conversations...')
    console.log('Press Ctrl+C to stop\n')

    // Keep process running
    await new Promise(() => {})

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    // Cleanup
    timerManager.stop()
    sdk.stopWatching()
    await sdk.close()
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⏹️  Shutting down Relationship Agent...')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n\n⏹️  Shutting down Relationship Agent...')
  process.exit(0)
})

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Run the application
main().catch(error => {
  console.error('❌ Application error:', error)
  process.exit(1)
})
