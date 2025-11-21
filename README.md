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
- **OpenAI API Key** (for GPT-4o-mini)

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
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` and add your configuration:**
   ```bash
   # Required
   OPENAI_API_KEY=sk-your-actual-api-key-here

   # Required: Your phone number or iMessage ID
   USER_IDENTIFIER=+1234567890

   # Optional (defaults shown)
   INACTIVITY_THRESHOLD_MS=120000  # 2 minutes
   MAX_AGENT_MESSAGES=3
   STYLE_ANALYSIS_MESSAGE_COUNT=50
   TIMER_CHECK_INTERVAL_MS=30000   # 30 seconds
   DEBUG=true
   ```

## Grant Full Disk Access

The iMessage SDK requires Full Disk Access to read the iMessage database:

1. Open **System Settings** → **Privacy & Security** → **Full Disk Access**
2. Click the **+** button
3. Add your **Terminal** app (or IDE like VS Code)
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

## How It Works

### 1. **Monitoring Phase**
- Watches all iMessage conversations in real-time
- Tracks last outgoing message timestamp per conversation
- Detects incoming messages from friends

### 2. **Inactivity Detection**
- Every 30 seconds, checks for conversations inactive for 2+ minutes
- Only triggers if friend has sent a recent message (within 5 minutes)
- Ignores conversations older than 1 hour

### 3. **Approval Request**
- Sends prompt: "Hey, are you trying to ghost [Name] or do you want me to take over?"
- Waits for your response
- Accepts: "take over", "yes", "sure", "ok", etc.
- Denies: "no", "nope", "don't", etc.

### 4. **Agent Activation**
- Analyzes your last 50 messages for style patterns
- Reads recent conversation with friend for context
- Generates contextually appropriate response in your style

### 5. **Conversation Loop**
- Sends message to friend
- Waits up to 60 seconds for response
- If response received, continues conversation
- Maximum 2-3 messages before wind-down

### 6. **Wind-Down**
- After 2-3 messages, generates natural exit message
- Examples (matched to your style):
  - Casual: "gotta run but talk soon!"
  - Brief: "gtg ttyl"
  - Proper: "I need to go, but let's talk later!"

### 7. **Deactivation**
- Returns control to you
- If you respond at any time, agent immediately stops

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | **Required.** Your OpenAI API key |
| `USER_IDENTIFIER` | - | **Required.** Your phone number (+1234567890) or iMessage ID |
| `INACTIVITY_THRESHOLD_MS` | 120000 | Time before triggering takeover prompt (2 min) |
| `MAX_AGENT_MESSAGES` | 3 | Max messages agent sends before wind-down |
| `STYLE_ANALYSIS_MESSAGE_COUNT` | 50 | Number of recent messages to analyze for style |
| `TIMER_CHECK_INTERVAL_MS` | 30000 | How often to check for inactivity (30 sec) |
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
├── .env                             # Your configuration
├── .env.example                     # Example configuration
├── tsconfig.json                    # TypeScript config
├── package.json                     # Dependencies & scripts
└── plan.md                          # Detailed implementation plan
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
   - Friend doesn't respond for 1 minute
   - Verify agent winds down

5. **Multiple Conversations:**
   - Be inactive in 2+ conversations
   - Verify agent handles each separately
   - Verify no context mixing

## Important Notes

### Privacy & Security
- All message data stays local on your Mac
- Only style analysis and conversation context sent to OpenAI
- No messages stored persistently (in-memory only for demo)
- Get consent from friends before using AI-generated messages

### Cost
- Uses OpenAI GPT-4o-mini (~$0.15 per 1M input tokens)
- Typical conversation costs < $0.01
- Monitor usage in OpenAI dashboard

### Limitations
- **macOS only** (requires iMessage database access)
- **Single user** per machine
- **Network required** for OpenAI API
- **2-3 message limit** to avoid detection
- **English only** (adjust prompts for other languages)

## Troubleshooting

### "Error: OPENAI_API_KEY not set"
- Check `.env` file exists and contains valid API key
- Ensure key starts with `sk-`

### "Warning: USER_IDENTIFIER not properly set"
- Update `.env` with your phone number: `USER_IDENTIFIER=+1234567890`
- Or use your iMessage ID if you know it

### "Permission denied" when accessing iMessage database
- Grant Full Disk Access to Terminal/IDE (see setup above)
- Restart Terminal/IDE after granting access

### Agent not detecting inactivity
- Check DEBUG=true in `.env` for detailed logs
- Verify you have recent conversations (within last 5 minutes)
- Default threshold is 2 minutes - adjust if needed

### Messages don't match my style
- Agent needs at least 20-30 message samples
- Increase `STYLE_ANALYSIS_MESSAGE_COUNT` in `.env`
- Review agent instructions in `src/agent/relationship-agent.ts`

## Future Enhancements

- [ ] Persistent storage (SQLite) for conversation history
- [ ] Per-relationship style learning
- [ ] Preview mode (review before sending)
- [ ] Scheduling & smart timing
- [ ] Multi-platform support (WhatsApp, Telegram)
- [ ] Fine-tuned models for better style matching

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Credits

Built with:
- [@photon-ai/imessage-kit](https://github.com/photon-ai/imessage-kit) - iMessage SDK
- [Mastra AI](https://mastra.ai) - AI agent framework
- [OpenAI GPT-4o-mini](https://platform.openai.com/docs/models/gpt-4o-mini) - Language model

## Disclaimer

This is a demo project for educational purposes. Use responsibly and with consent from your contacts. The author is not responsible for any misuse or consequences of using this tool.

---

## Original Demos

The original iMessage SDK demos are still available:
- `npm run demo` - Basic SDK demo
- `npm run demo:watch` - Real-time watcher demo

See `imessage-kit.md` for complete SDK documentation.
