# iMessage SDK Demo

A simple demonstration of the `@photon-ai/imessage-kit` SDK capabilities.

## Prerequisites

1. **macOS only** - The SDK accesses the native iMessage database
2. **Full Disk Access** - Grant permission to your terminal/IDE:
   - Open System Settings → Privacy & Security → Full Disk Access
   - Add your terminal app (Terminal, iTerm, Warp) or IDE (VS Code, Cursor, Zed)
3. **Bun or Node.js** - Bun is recommended for zero dependencies

## Installation

```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

## Running the Demos

### Basic Demo
Shows how to read messages, list chats, and explains sending:

```bash
bun run demo
# or
npm run demo
```

This demo will:
- ✉️ Fetch and display unread messages
- 💬 List your recent chats (both DMs and groups)
- 📨 Show recent message history
- 📤 Explain how to send messages (commented for safety)

### Real-time Watcher Demo
Monitors for new messages in real-time:

```bash
bun run demo:watch
# or
npm run demo:watch
```

This demo will:
- 🔭 Watch for new direct messages
- 👥 Watch for new group messages
- 🔄 Show real-time notifications
- Press Ctrl+C to stop

## Features Demonstrated

### Reading Messages
```typescript
// Get unread messages
const unread = await sdk.getUnreadMessages()

// Query with filters
const messages = await sdk.getMessages({
  limit: 10,
  unreadOnly: true,
  sender: '+1234567890'
})
```

### Listing Chats
```typescript
// List all chats
const chats = await sdk.listChats()

// Filter and search
const groups = await sdk.listChats({
  type: 'group',
  hasUnread: true,
  search: 'Project'
})
```

### Sending Messages
```typescript
// Send text
await sdk.send('+1234567890', 'Hello!')

// Send with images
await sdk.send('+1234567890', {
  text: 'Check this out',
  images: ['photo.jpg']
})

// Send to group (use chatId from listChats)
await sdk.send('chat123...', 'Hello group!')
```

### Real-time Watching
```typescript
await sdk.startWatching({
  onDirectMessage: async (message) => {
    console.log('New DM:', message.text)
  },
  onGroupMessage: async (message) => {
    console.log('New group message:', message.text)
  }
})
```

## Safety Notes

- The demo has message sending **commented out** by default
- Review the code before uncommenting send operations
- Replace placeholder phone numbers with real recipients
- Start with test messages to yourself first

## Next Steps

1. **Review the code** - Both demos are well-commented
2. **Uncomment sending** - When ready, enable the send examples
3. **Build your app** - Use this as a starting point for your own iMessage automation

## Documentation

See `imessage-kit.md` for the complete SDK documentation.

## License

MIT
