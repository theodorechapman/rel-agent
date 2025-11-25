# Relationship Agent 🤖💬

An AI-powered iMessage assistant that monitors your conversations, detects inactivity, and offers to take over conversations in your exact texting style. Built with [`@photon-ai/imessage-kit`](https://github.com/photon-ai/imessage-kit) and [Mastra AI framework](https://mastra.ai).

## Features

- **Automatic Inactivity Detection**: Monitors conversations and detects when you haven't responded for 2+ minutes
- **Smart Takeover Prompts**: Asks for permission before taking over ("Hey, are you trying to ghost [Name] or do you want me to take over?")
- **Style Matching**: Analyzes your last 50 messages to match your:
  - Tone and vocabulary
  - Message length
  - Capitalization patterns
  - Emoji usage
  - Punctuation style
- **Natural Conversations**: Sends 2-3 contextually appropriate responses
- **Graceful Wind-Down**: Exits conversations naturally in your style
- **User Control**: Instantly deactivates if you respond manually
- **5-Minute Control Window**: Agent automatically deactivates after 5 minutes to prevent over-automation

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Main Application                    │
│                  (src/index.ts)                      │
└───────────────┬─────────────────────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
┌───▼────────┐      ┌──────▼──────┐
│  iMessage  │      │   Mastra    │
│   Watcher  │      │   Agent     │
│            │      │             │
│ - Monitor  │      │ - Style     │
│ - Track    │◄────►│   Analysis  │
│ - Trigger  │      │ - Response  │
└────────────┘      │   Gen       │
                    │ - Wind Down │
                    └─────────────┘
```

## Prerequisites

- **macOS** with iMessage configured
- **Node.js 18+** or **Bun 1.0+**
- **Full Disk Access** granted to your Terminal/IDE
- **Cerebras API Key** (for GPT-OSS-120B model)

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd rel-agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   
   Create a `.env` file in the root directory:
   ```bash
   # Required
   CEREBRAS_API_KEY=your-cerebras-api-key-here

   # Required: Your phone number or iMessage ID
   USER_IDENTIFIER=+1234567890

   # Optional (defaults shown)
   INACTIVITY_THRESHOLD_MS=120000  # 2 minutes
   MAX_AGENT_MESSAGES=3
   STYLE_ANALYSIS_MESSAGE_COUNT=50
   TIMER_CHECK_INTERVAL_MS=30000   # 30 seconds
   MAX_INACTIVITY_MS=3600000       # 1 hour
   DEBUG=false
   ```

## Grant Full Disk Access

The iMessage SDK requires Full Disk Access to read the iMessage database:

1. Open **System Settings** → **Privacy & Security** → **Full Disk Access**
2. Click the **+** button
3. Add your **Terminal** app (or IDE like VS Code/Cursor)
4. Restart your Terminal/IDE

## Usage

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Demo Scripts
The original iMessage SDK demos are still available:
- `npm run demo` - Basic SDK demo
- `npm run demo:watch` - Real-time watcher demo

## How It Works

### 1. **Monitoring Phase**
- Watches all iMessage conversations in real-time
- Tracks last outgoing message timestamp per conversation
- Detects incoming messages from friends
- Polls every 2 seconds for new messages

### 2. **Inactivity Detection**
- Every 30 seconds, checks for conversations inactive for 2+ minutes
- Only triggers if friend has sent a recent message (within 5 minutes)
- Ignores conversations older than 1 hour
- Prevents duplicate prompts (won't prompt if already awaiting approval or agent is active)

### 3. **Approval Request**
- Sends prompt: "Hey, are you trying to ghost [Name] or do you want me to take over?"
- Waits for your response
- Accepts: "take over", "yes", "sure", "ok", etc.
- Denies: "no", "nope", "don't", etc.
- Ignores the prompt message itself to prevent false approvals

### 4. **Agent Activation**
- Analyzes your last 50 messages for style patterns
- Reads recent conversation with friend for context (last 20 messages)
- Generates contextually appropriate response in your style
- Uses Cerebras GPT-OSS-120B model via Mastra AI framework

### 5. **Conversation Loop**
- Sends message to friend
- Waits for friend's response (event-driven)
- If response received within 5 minutes, continues conversation
- Adds 5-second delay before sending next message for natural pacing
- Maximum 2-3 messages before wind-down (configurable)

### 6. **Wind-Down**
- After reaching message limit, generates natural exit message
- Examples (matched to your style):
  - Casual: "gotta run but talk soon!"
  - Brief: "gtg ttyl"
  - Proper: "I need to go, but let's talk later!"

### 7. **Deactivation**
- Returns control to you automatically after 5-minute window
- If you respond at any time, agent immediately stops
- Agent deactivates after reaching message limit

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CEREBRAS_API_KEY` | - | **Required.** Your Cerebras API key |
| `USER_IDENTIFIER` | - | **Required.** Your phone number (+1234567890) or iMessage ID |
| `INACTIVITY_THRESHOLD_MS` | 120000 | Time before triggering takeover prompt (2 min) |
| `MAX_AGENT_MESSAGES` | 3 | Max messages agent sends before wind-down |
| `STYLE_ANALYSIS_MESSAGE_COUNT` | 50 | Number of recent messages to analyze for style |
| `TIMER_CHECK_INTERVAL_MS` | 30000 | How often to check for inactivity (30 sec) |
| `MAX_INACTIVITY_MS` | 3600000 | Maximum inactivity before giving up (1 hour) |
| `DEBUG` | false | Enable debug logging |

## Project Structure

```
rel-agent/
├── src/
│   ├── agent/
│   │   ├── relationship-agent.ts    # Main Mastra agent definition
│   │   └── tools/
│   │       ├── style-analyzer.ts    # Analyzes user texting style
│   │       ├── message-generator.ts # Generates responses
│   │       └── wind-down-detector.ts# Detects conversation end
│   ├── watchers/
│   │   └── conversation-tracker.ts  # Tracks conversation state
│   ├── utils/
│   │   ├── approval-parser.ts       # Parses user approval/denial
│   │   ├── timer-manager.ts         # Manages inactivity timers
│   │   └── agent-core.ts            # Core agent logic
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces
│   └── index.ts                     # Main entry point
├── demo.ts                          # Basic SDK demo
├── demo-watch.ts                    # Real-time watcher demo
├── tsconfig.json                    # TypeScript config
├── package.json                     # Dependencies & scripts
└── .env                             # Your configuration (create this)
```

## Testing

### Manual Testing Scenarios

1. **Happy Path:**
   - Start conversation with a friend
   - Stop responding for 2+ minutes
   - Receive agent prompt
   - Reply "take over"
   - Verify agent sends 2-3 natural messages
   - Verify agent winds down gracefully

2. **User Denial:**
   - Wait for inactivity prompt
   - Reply "no"
   - Verify agent does not activate

3. **User Takes Back Control:**
   - Approve agent takeover
   - While agent is active, send your own message
   - Verify agent stops immediately

4. **Friend No Response:**
   - Agent sends message
   - Friend doesn't respond for 5+ minutes
   - Verify agent deactivates automatically

5. **Multiple Conversations:**
   - Be inactive in 2+ conversations
   - Verify agent handles each separately
   - Verify no context mixing

6. **5-Minute Window:**
   - Activate agent
   - Wait 5+ minutes without friend response
   - Verify agent deactivates automatically

## Important Notes

### Privacy & Security
- All message data stays local on your Mac
- Only style analysis and conversation context sent to Cerebras API
- No messages stored persistently (in-memory only)
- Get consent from friends before using AI-generated messages

### Cost
- Uses Cerebras GPT-OSS-120B model
- Check Cerebras pricing for current rates
- Typical conversation costs are minimal
- Monitor usage in Cerebras dashboard

### Limitations
- **macOS only** (requires iMessage database access)
- **Single user** per machine
- **Network required** for Cerebras API
- **2-3 message limit** to avoid detection (configurable)
- **5-minute control window** - agent auto-deactivates after 5 minutes
- **English only** (adjust prompts for other languages)

## Troubleshooting

### "Error: CEREBRAS_API_KEY not set"
- Check `.env` file exists and contains valid API key
- Ensure key is properly formatted

### "Warning: USER_IDENTIFIER not properly set"
- Update `.env` with your phone number: `USER_IDENTIFIER=+1234567890`
- Or use your iMessage ID if you know it
- Must match exactly how it appears in your iMessage database

### "Permission denied" when accessing iMessage database
- Grant Full Disk Access to Terminal/IDE (see setup above)
- Restart Terminal/IDE after granting access
- Verify the correct app is added (Terminal, VS Code, or Cursor)

### Agent not detecting inactivity
- Check `DEBUG=true` in `.env` for detailed logs
- Verify you have recent conversations (within last 5 minutes)
- Default threshold is 2 minutes - adjust if needed
- Ensure `USER_IDENTIFIER` matches your actual identifier

### Messages don't match my style
- Agent needs at least 20-30 message samples
- Increase `STYLE_ANALYSIS_MESSAGE_COUNT` in `.env`
- Review agent instructions in `src/agent/relationship-agent.ts`
- Check debug logs to see what style patterns were detected

### Agent sends duplicate messages
- This should be prevented by the conversation tracker
- Check debug logs for conversation state
- Verify `isAgentActive` flag is working correctly
- Restart the application if state gets corrupted

### Agent doesn't deactivate
- Agent should auto-deactivate after 5 minutes
- Check if you're within the `AI_CONTROL_WINDOW_MS` window
- Verify message count hasn't exceeded `MAX_AGENT_MESSAGES`
- Send a manual message to force deactivation

## Technical Details

### Event-Driven Architecture
The agent uses an event-driven approach:
- When agent sends a message, it returns immediately
- The incoming message handler detects friend responses
- Triggers next agent message after 5-second delay
- Prevents blocking and allows natural conversation flow

### Conversation State Management
- Each conversation tracked independently
- State includes: last message timestamps, agent status, message count
- Prevents duplicate activations and context mixing
- Automatic cleanup after deactivation

### Style Analysis
- Analyzes last N messages (default: 50)
- Detects: message length, capitalization, punctuation, emoji usage
- Creates style guide for LLM
- Updates dynamically as you send more messages

## Future Enhancements

- [ ] Persistent storage (SQLite) for conversation history
- [ ] Per-relationship style learning
- [ ] Preview mode (review before sending)
- [ ] Scheduling & smart timing
- [ ] Multi-platform support (WhatsApp, Telegram)
- [ ] Fine-tuned models for better style matching
- [ ] Webhook notifications for agent activity
- [ ] Conversation analytics dashboard

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Credits

Built with:
- [@photon-ai/imessage-kit](https://github.com/photon-ai/imessage-kit) - iMessage SDK
- [Mastra AI](https://mastra.ai) - AI agent framework
- [Cerebras GPT-OSS-120B](https://www.cerebras.ai) - Language model
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Disclaimer

This is a demo project for educational purposes. Use responsibly and with consent from your contacts. The author is not responsible for any misuse or consequences of using this tool. Always inform your contacts when using automated messaging tools.

---

## Additional Resources

- See `imessage-kit.md` for complete SDK documentation
- See `plan.md` for detailed implementation plan
- See `demo.ts` and `demo-watch.ts` for SDK usage examples
