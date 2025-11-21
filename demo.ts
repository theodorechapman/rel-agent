/**
 * Simple iMessage SDK Demo
 *
 * This demo showcases the core features of @photon-ai/imessage-kit:
 * - Getting unread messages
 * - Listing chats
 * - Sending messages (commented out for safety)
 * - Error handling
 */

import { IMessageSDK } from '@photon-ai/imessage-kit'

async function main() {
  console.log('🚀 iMessage SDK Demo\n')

  // Initialize SDK with debug mode
  const sdk = new IMessageSDK({
    debug: true,
    maxConcurrent: 5
  })

  try {
    // 1. Get unread messages
    console.log('📬 Fetching unread messages...')
    const unread = await sdk.getUnreadMessages()
    console.log(`\n✉️  Total unread: ${unread.total} from ${unread.senderCount} senders\n`)

    for (const { sender, messages } of unread.groups) {
      console.log(`  ${sender}: ${messages.length} unread message(s)`)
      // Show first message preview
      if (messages[0].text) {
        const preview = messages[0].text.substring(0, 50)
        console.log(`    Preview: "${preview}${messages[0].text.length > 50 ? '...' : ''}"`)
      }
    }

    // 2. List recent chats
    console.log('\n\n💬 Listing recent chats...')
    const chats = await sdk.listChats({ limit: 10, sortBy: 'recent' })
    console.log(`\nFound ${chats.length} recent chats:\n`)

    for (const chat of chats) {
      const type = chat.isGroup ? '👥 Group' : '👤 DM'
      const unreadBadge = chat.unreadCount > 0 ? ` (${chat.unreadCount} unread)` : ''
      console.log(`  ${type}: ${chat.displayName}${unreadBadge}`)
      console.log(`    Chat ID: ${chat.chatId}`)
      console.log(`    Last message: ${chat.lastMessageAt?.toLocaleString() || 'N/A'}`)
    }

    // 3. Get recent messages with filters
    console.log('\n\n📨 Fetching last 5 messages...')
    const recent = await sdk.getMessages({
      limit: 5,
      excludeOwnMessages: true
    })

    console.log(`\nFound ${recent.total} total messages (showing ${recent.messages.length}):\n`)
    for (const msg of recent.messages) {
      const type = msg.isGroupChat ? '[Group]' : '[DM]'
      const read = msg.isRead ? '✓' : '◯'
      console.log(`  ${read} ${type} ${msg.senderName || msg.sender}`)
      console.log(`    ${msg.text || '(no text)'}`)
      console.log(`    ${msg.date.toLocaleString()}\n`)
    }

    // 4. Send message example (commented for safety)
    console.log('\n\n📤 Send message example (commented out for safety):')
    console.log('  // await sdk.send(\'+1234567890\', \'Hello from iMessage SDK!\')')
    console.log('  // await sdk.send(\'+1234567890\', { text: \'Check this\', images: [\'photo.jpg\'] })')
    console.log('  // await sdk.send(\'chat123...\', \'Hello group!\')')

    // Uncomment to actually send a message:
    const recipient = '+14258660088' // Replace with actual number
    await sdk.send(recipient, 'FUCK YOU')
    console.log(`✅ Message sent to ${recipient}`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    // Always close the SDK when done
    console.log('\n\n🔒 Closing SDK...')
    await sdk.close()
    console.log('✅ Demo complete!')
  }
}

// Run the demo
main().catch(console.error)
