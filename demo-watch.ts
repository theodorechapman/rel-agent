/**
 * iMessage SDK - Real-time Message Watching Demo
 *
 * This demo showcases the real-time message watching capabilities:
 * - Watch for new direct messages
 * - Watch for group messages
 * - Auto-reply to messages (commented out for safety)
 */

import { IMessageSDK } from '@photon-ai/imessage-kit'

async function main() {
  console.log('🔭 iMessage SDK - Message Watcher Demo\n')
  console.log('Press Ctrl+C to stop watching\n')

  // Initialize SDK with watcher configuration
  const sdk = new IMessageSDK({
    debug: false, // Disable debug to reduce noise
    watcher: {
      pollInterval: 2000,         // Check every 2 seconds
      unreadOnly: false,          // Watch all messages
      excludeOwnMessages: true,   // Don't watch our own messages
      initialLookbackMs: 5000     // Look back 5 seconds on start
    }
  })

  try {
    // Start watching for messages
    await sdk.startWatching({
      // Handle direct messages
      onDirectMessage: async (message) => {
        console.log('\n💬 New DM received:')
        console.log(`  From: ${message.senderName || message.sender}`)
        console.log(`  Message: ${message.text || '(attachment)'}`)
        console.log(`  Time: ${message.date.toLocaleString()}`)

        // Auto-reply example (commented for safety)
        // await sdk.message(message)
        //   .replyText('Thanks for your message! This is an auto-reply.')
        //   .execute()
        // console.log('  ✅ Auto-reply sent')
      },

      // Handle group messages
      onGroupMessage: async (message) => {
        console.log('\n👥 New group message:')
        console.log(`  Chat: ${message.chatId}`)
        console.log(`  From: ${message.senderName || message.sender}`)
        console.log(`  Message: ${message.text || '(attachment)'}`)
        console.log(`  Time: ${message.date.toLocaleString()}`)
      },

      // Handle errors
      onError: (error) => {
        console.error('\n❌ Watcher error:', error)
      }
    })

    console.log('✅ Watcher started successfully!')
    console.log('👀 Watching for new messages...\n')

    // Keep the process running
    await new Promise(() => {})
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    sdk.stopWatching()
    await sdk.close()
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⏹️  Stopping watcher...')
  process.exit(0)
})

// Run the watcher demo
main().catch(console.error)
