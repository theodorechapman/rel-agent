# Relationship Agent Implementation Plan

## Executive Summary

Build an iMessage-integrated AI assistant that monitors conversations, detects inactivity (>2 minutes), and offers to take over conversations in the user's style before gracefully winding down. Uses `@photon-ai/imessage-kit` for iMessage integration and Mastra AI framework for agent logic.

**Key Decisions:**
- LLM: OpenAI GPT-4o-mini (fast, cost-effective)
- Approval: Simple text matching ("take over", "yes", "sure")
- Style Learning: Last 50 messages from user
- Storage: In-memory only (demo simplicity)

---

## Architecture Overview

### High-Level Flow

```
1. Watcher monitors all outgoing messages
2. Track last message timestamp per conversation
3. Timer checks for 2+ minute inactivity
4. Agent sends prompt: "Hey, are you trying to ghost [Name] or do you want me to take over?"
5. User responds → parse approval
6. Agent analyzes last 50 user messages for style
7. Agent generates 2-3 style-matched responses
8. Agent detects natural wind-down point
9. Agent sends wind-down message
10. Hand control back to user
```

### Component Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Main Application                    │
│                  (relationship-agent.ts)             │
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

---

## Implementation Phases

### Phase 1: Project Setup & Core Infrastructure
**Goal:** Set up project structure, dependencies, and basic configuration

#### Tasks:
1. **Initialize Mastra Project**
   - Install: `npm install @mastra/core`
   - Install AI SDK: `npm install ai`
   - Setup OpenAI provider configuration
   - Create `.env` file with `OPENAI_API_KEY`

2. **Create Project Structure**
   ```
   /rel-agent
   ├── src/
   │   ├── agent/
   │   │   ├── relationship-agent.ts    # Main agent definition
   │   │   └── tools/
   │   │       ├── style-analyzer.ts    # Tool: analyze user style
   │   │       ├── message-generator.ts # Tool: generate responses
   │   │       └── wind-down-detector.ts# Tool: detect conversation end
   │   ├── watchers/
   │   │   └── conversation-tracker.ts  # Track conversation state
   │   ├── utils/
   │   │   ├── approval-parser.ts       # Parse user approval
   │   │   └── timer-manager.ts         # Handle inactivity timers
   │   ├── types/
   │   │   └── index.ts                 # TypeScript interfaces
   │   └── index.ts                     # Main entry point
   ├── .env
   ├── tsconfig.json
   └── package.json
   ```

3. **Define Core Types**
   ```typescript
   interface ConversationState {
     chatId: string
     friendName: string
     lastOutgoingTimestamp: Date
     lastIncomingTimestamp: Date
     isAgentActive: boolean
     messagesSent: number
     userMessageHistory: Message[]
   }

   interface AgentConfig {
     inactivityThresholdMs: number  // 120000 (2 minutes)
     maxMessagesToSend: number      // 2-3 before wind down
     styleAnalysisCount: number     // 50 messages
     approvalKeywords: string[]     // ["take over", "yes", "sure", "ok"]
   }
   ```

---

### Phase 2: iMessage Watcher Integration
**Goal:** Monitor conversations and detect inactivity

#### Tasks:

1. **Create ConversationTracker Class**
   - Track multiple active conversations in memory
   - Store conversation state (chatId, timestamps, status)
   - Methods:
     ```typescript
     class ConversationTracker {
       private conversations: Map<string, ConversationState>

       updateOutgoingMessage(chatId: string, message: Message): void
       updateIncomingMessage(chatId: string, message: Message): void
       getInactiveConversations(thresholdMs: number): ConversationState[]
       markAgentActive(chatId: string): void
       markAgentInactive(chatId: string): void
       getUserMessageHistory(chatId: string, limit: number): Message[]
     }
     ```

2. **Implement Message Watcher**
   ```typescript
   // In src/watchers/conversation-tracker.ts

   const sdk = new IMessageSDK({
     watcher: {
       pollInterval: 2000,
       unreadOnly: false,
       excludeOwnMessages: false  // Need to track our own messages
     }
   })

   await sdk.startWatching({
     onMessage: async (message) => {
       if (message.isFromMe) {
         // User sent a message - reset timer
         tracker.updateOutgoingMessage(message.chatId, message)
       } else {
         // Friend sent a message - track for context
         tracker.updateIncomingMessage(message.chatId, message)
       }
     }
   })
   ```

3. **Implement Inactivity Timer**
   ```typescript
   // In src/utils/timer-manager.ts

   class TimerManager {
     private timers: Map<string, NodeJS.Timeout>

     startInactivityCheck(interval: number, callback: () => void): void {
       // Every 30 seconds, check for inactive conversations
       setInterval(() => {
         const inactive = tracker.getInactiveConversations(120000) // 2 min
         for (const conv of inactive) {
           if (!conv.isAgentActive) {
             callback(conv)
           }
         }
       }, interval)
     }
   }
   ```

4. **Extract Friend Name from Conversation**
   ```typescript
   async function getFriendName(chatId: string): Promise<string> {
     const chats = await sdk.listChats({ search: chatId })
     if (chats.length > 0) {
       return chats[0].displayName
     }
     // Fallback: extract from chatId or use "your friend"
     return "your friend"
   }
   ```

---

### Phase 3: Mastra Agent Setup
**Goal:** Create AI agent with tools for style analysis and response generation

#### Tasks:

1. **Create Style Analyzer Tool**
   ```typescript
   // In src/agent/tools/style-analyzer.ts

   import { createTool } from '@mastra/core/tools'
   import { z } from 'zod'

   export const styleAnalyzerTool = createTool({
     id: 'analyze-user-style',
     description: 'Analyzes the last N messages from the user to understand their texting style, tone, vocabulary, and patterns.',
     inputSchema: z.object({
       messages: z.array(z.object({
         text: z.string(),
         date: z.string()
       })),
       count: z.number().default(50)
     }),
     outputSchema: z.object({
       tone: z.string(), // casual, formal, friendly, etc.
       averageLength: z.number(),
       commonPhrases: z.array(z.string()),
       emojiUsage: z.string(), // none, rare, frequent
       typingPatterns: z.string(), // proper punctuation, lowercase, etc.
       styleGuide: z.string() // Summary for LLM
     }),
     execute: async ({ context }) => {
       const { messages, count } = context
       const recentMessages = messages.slice(-count)

       // Analyze tone, length, patterns
       const totalLength = recentMessages.reduce((sum, m) => sum + m.text.length, 0)
       const avgLength = totalLength / recentMessages.length

       // Detect emoji usage
       const emojiCount = recentMessages.filter(m => /[\u{1F600}-\u{1F64F}]/u.test(m.text)).length
       const emojiUsage = emojiCount === 0 ? 'none' : emojiCount < 5 ? 'rare' : 'frequent'

       // Detect capitalization and punctuation
       const properCaps = recentMessages.filter(m => /^[A-Z]/.test(m.text)).length > recentMessages.length / 2
       const usesPunctuation = recentMessages.filter(m => /[.!?]$/.test(m.text)).length > recentMessages.length / 2

       const typingPatterns = properCaps && usesPunctuation
         ? 'Proper capitalization and punctuation'
         : !properCaps ? 'Mostly lowercase, casual'
         : 'Mixed style'

       // Extract common phrases (simple approach)
       const allText = recentMessages.map(m => m.text.toLowerCase()).join(' ')
       const words = allText.split(/\s+/)
       const commonPhrases = [...new Set(words)].slice(0, 10)

       // Create style guide
       const styleGuide = `
         The user writes in a ${avgLength < 30 ? 'brief' : avgLength < 100 ? 'moderate' : 'lengthy'} style.
         ${typingPatterns}.
         Emoji usage: ${emojiUsage}.
         Common expressions: ${commonPhrases.join(', ')}.
         Match this style closely when generating responses.
       `.trim()

       return {
         tone: avgLength < 50 ? 'casual' : 'conversational',
         averageLength: avgLength,
         commonPhrases,
         emojiUsage,
         typingPatterns,
         styleGuide
       }
     }
   })
   ```

2. **Create Message Generator Tool**
   ```typescript
   // In src/agent/tools/message-generator.ts

   export const messageGeneratorTool = createTool({
     id: 'generate-message',
     description: 'Generates a message in the user\'s style based on conversation context and style analysis.',
     inputSchema: z.object({
       conversationHistory: z.array(z.object({
         sender: z.string(),
         text: z.string(),
         timestamp: z.string()
       })),
       styleGuide: z.string(),
       friendName: z.string()
     }),
     outputSchema: z.object({
       message: z.string(),
       shouldContinue: z.boolean(),
       reasoning: z.string()
     }),
     execute: async ({ context }) => {
       const { conversationHistory, styleGuide, friendName } = context

       // This tool will be called by the agent's LLM
       // The LLM will use the style guide and conversation history
       // to generate an appropriate response

       // For now, return structure for agent to populate
       return {
         message: '',
         shouldContinue: true,
         reasoning: ''
       }
     }
   })
   ```

3. **Create Wind-Down Detector Tool**
   ```typescript
   // In src/agent/tools/wind-down-detector.ts

   export const windDownDetectorTool = createTool({
     id: 'detect-wind-down',
     description: 'Analyzes conversation to determine if it\'s time to wind down and exit gracefully.',
     inputSchema: z.object({
       conversationHistory: z.array(z.object({
         sender: z.string(),
         text: z.string()
       })),
       messagesSent: z.number()
     }),
     outputSchema: z.object({
       shouldWindDown: z.boolean(),
       reason: z.string(),
       suggestedExitMessage: z.string()
     }),
     execute: async ({ context }) => {
       const { conversationHistory, messagesSent } = context

       // Wind down conditions:
       // 1. Sent 2-3 messages already
       // 2. Natural pause in conversation
       // 3. Question has been answered
       // 4. Conversation topic concluding

       const shouldWindDown = messagesSent >= 2

       if (shouldWindDown) {
         return {
           shouldWindDown: true,
           reason: 'Sent sufficient messages to maintain conversation',
           suggestedExitMessage: "anyway i gotta run but talk soon!"
         }
       }

       return {
         shouldWindDown: false,
         reason: 'Continue conversation',
         suggestedExitMessage: ''
       }
     }
   })
   ```

4. **Create Main Relationship Agent**
   ```typescript
   // In src/agent/relationship-agent.ts

   import { Agent } from '@mastra/core/agent'
   import { openai } from '@ai-sdk/openai'

   export const relationshipAgent = new Agent({
     name: 'relationship-agent',
     instructions: `
       You are a helpful assistant that helps users maintain their text message conversations.

       Your role:
       1. Analyze the user's texting style from their message history
       2. Continue conversations on their behalf in their exact style
       3. Keep conversations natural and brief (2-3 messages max)
       4. Wind down conversations gracefully

       Important guidelines:
       - Match the user's tone, vocabulary, and message length exactly
       - Use their typical emoji patterns and capitalization
       - Don't overcommit or make plans
       - Exit naturally (e.g., "gotta run", "talk later", "catch you later")
       - Never reveal you're an AI

       When generating messages:
       1. First analyze the user's style
       2. Review the conversation context
       3. Generate a natural response in their style
       4. After 2-3 messages, find a natural exit point
       5. Send a friendly wind-down message
     `,
     model: {
       provider: openai('gpt-4o-mini'),
       toolChoice: 'auto'
     },
     tools: {
       styleAnalyzer: styleAnalyzerTool,
       messageGenerator: messageGeneratorTool,
       windDownDetector: windDownDetectorTool
     }
   })
   ```

---

### Phase 4: Agent Activation & Approval Flow
**Goal:** Send prompt, parse approval, activate agent

#### Tasks:

1. **Create Approval Parser**
   ```typescript
   // In src/utils/approval-parser.ts

   const APPROVAL_KEYWORDS = [
     'take over',
     'yes',
     'yeah',
     'sure',
     'ok',
     'okay',
     'do it',
     'go ahead',
     'please'
   ]

   export function isApproval(messageText: string): boolean {
     const normalized = messageText.toLowerCase().trim()
     return APPROVAL_KEYWORDS.some(keyword => normalized.includes(keyword))
   }

   export function isDenial(messageText: string): boolean {
     const denials = ['no', 'nope', 'don\'t', 'cancel', 'nevermind', 'nah']
     const normalized = messageText.toLowerCase().trim()
     return denials.some(keyword => normalized.includes(keyword))
   }
   ```

2. **Implement Prompt Sending**
   ```typescript
   // In main application

   async function sendTakeoverPrompt(conv: ConversationState): Promise<void> {
     const friendName = await getFriendName(conv.chatId)
     const promptMessage = `Hey, are you trying to ghost ${friendName} or do you want me to take over?`

     // Send to user (their own number/self)
     // Note: Need to determine user's own identifier
     const userSelf = await getUserOwnIdentifier()
     await sdk.send(userSelf, promptMessage)

     // Mark as waiting for approval
     tracker.markAwaitingApproval(conv.chatId)
   }
   ```

3. **Handle Approval Response**
   ```typescript
   // In watcher callback

   onMessage: async (message) => {
     const conv = tracker.getConversation(message.chatId)

     if (conv?.awaitingApproval && message.isFromMe) {
       if (isApproval(message.text)) {
         // User approved - activate agent
         await activateAgent(conv)
       } else if (isDenial(message.text)) {
         // User denied - reset
         tracker.resetConversation(conv.chatId)
       }
     }
   }
   ```

---

### Phase 5: Agent Execution & Message Generation
**Goal:** Agent takes over conversation, generates style-matched responses

#### Tasks:

1. **Implement Agent Activation**
   ```typescript
   async function activateAgent(conv: ConversationState): Promise<void> {
     // 1. Mark agent as active
     tracker.markAgentActive(conv.chatId)

     // 2. Get user's message history
     const userMessages = tracker.getUserMessageHistory(conv.chatId, 50)

     // 3. Get recent conversation with friend
     const recentMessages = await sdk.getMessages({
       // Filter by chatId - need to implement this
       limit: 20
     })

     // 4. Start agent execution
     await runAgentConversation(conv, userMessages, recentMessages)
   }
   ```

2. **Create Agent Conversation Loop**
   ```typescript
   async function runAgentConversation(
     conv: ConversationState,
     userMessages: Message[],
     conversationHistory: Message[]
   ): Promise<void> {

     let messagesSent = 0
     const maxMessages = 3

     while (messagesSent < maxMessages) {
       // Build context for agent
       const context = `
         User's message history (for style analysis):
         ${userMessages.map(m => m.text).join('\n')}

         Recent conversation with ${conv.friendName}:
         ${conversationHistory.map(m => `${m.senderName}: ${m.text}`).join('\n')}

         You have sent ${messagesSent} messages so far.
         ${messagesSent >= 2 ? 'Consider winding down the conversation.' : ''}
       `

       // Call agent
       const response = await relationshipAgent.generate([
         {
           role: 'user',
           content: context
         }
       ])

       // Parse response and extract message to send
       const agentMessage = response.text

       // Check if should wind down
       if (messagesSent >= 2 || agentMessage.includes('[WIND_DOWN]')) {
         // Send wind-down message
         await sendWindDownMessage(conv)
         break
       }

       // Send message to friend
       await sdk.send(conv.chatId, agentMessage)
       messagesSent++

       // Wait for friend's response (with timeout)
       const friendResponse = await waitForResponse(conv.chatId, 60000) // 1 min timeout

       if (!friendResponse) {
         // No response - wind down
         await sendWindDownMessage(conv)
         break
       }

       // Update conversation history
       conversationHistory.push(friendResponse)
     }

     // Deactivate agent
     tracker.markAgentInactive(conv.chatId)
   }
   ```

3. **Implement Response Waiting**
   ```typescript
   async function waitForResponse(
     chatId: string,
     timeoutMs: number
   ): Promise<Message | null> {

     return new Promise((resolve) => {
       const timeout = setTimeout(() => {
         cleanup()
         resolve(null)
       }, timeoutMs)

       const messageHandler = (message: Message) => {
         if (message.chatId === chatId && !message.isFromMe) {
           cleanup()
           resolve(message)
         }
       }

       // Add temporary listener
       sdk.startWatching({ onMessage: messageHandler })

       const cleanup = () => {
         clearTimeout(timeout)
         // Remove listener (need SDK support for this)
       }
     })
   }
   ```

4. **Create Wind-Down Logic**
   ```typescript
   async function sendWindDownMessage(conv: ConversationState): Promise<void> {
     // Use agent to generate natural wind-down based on user's style
     const windDownPrompt = `
       Generate a brief, natural exit message in the user's style.
       Examples: "gotta run but talk soon!", "anyway catch you later", "i'll text you later"
       Keep it casual and natural for this user's texting style.
     `

     const response = await relationshipAgent.generate([
       { role: 'user', content: windDownPrompt }
     ])

     await sdk.send(conv.chatId, response.text)
   }
   ```

---

### Phase 6: Edge Cases & Error Handling
**Goal:** Handle failures, conflicts, and unusual scenarios

#### Tasks:

1. **Handle User Response During Agent Activity**
   ```typescript
   // In watcher callback

   onMessage: async (message) => {
     const conv = tracker.getConversation(message.chatId)

     if (conv?.isAgentActive && message.isFromMe) {
       // User has responded - abort agent immediately
       console.log('User took back control - aborting agent')
       tracker.markAgentInactive(conv.chatId)
       // Cancel any pending agent operations
     }
   }
   ```

2. **Handle Friend Rapid Messages**
   ```typescript
   // In runAgentConversation, add delay before responding

   async function waitBeforeResponding(messages: Message[]): Promise<void> {
     // If friend sent multiple messages quickly, wait a bit
     const recentCount = messages.filter(m =>
       Date.now() - m.date.getTime() < 5000
     ).length

     if (recentCount > 1) {
       // Wait 3-5 seconds to seem natural
       await new Promise(resolve => setTimeout(resolve, 3000))
     }
   }
   ```

3. **Handle Long Gaps**
   ```typescript
   // In timer check

   function shouldTriggerAgent(conv: ConversationState): boolean {
     const inactivityMs = Date.now() - conv.lastOutgoingTimestamp.getTime()

     // Only trigger between 2 minutes and 1 hour
     if (inactivityMs < 120000) return false
     if (inactivityMs > 3600000) return false // Too long, don't trigger

     return true
   }
   ```

4. **Error Handling**
   ```typescript
   // Wrap all agent operations in try-catch

   try {
     await runAgentConversation(conv, userMessages, recentMessages)
   } catch (error) {
     console.error('Agent error:', error)

     // Send error notification to user
     await sdk.send(userSelf, `⚠️ Agent encountered an error with ${conv.friendName}. Taking back control.`)

     // Reset conversation
     tracker.markAgentInactive(conv.chatId)
   }
   ```

---

### Phase 7: Testing & Refinement
**Goal:** Validate functionality, fix bugs, improve UX

#### Testing Strategy:

1. **Unit Tests**
   - Test approval parser with various inputs
   - Test style analyzer with different message patterns
   - Test timer logic with various timestamps
   - Test conversation state tracking

2. **Integration Tests**
   - Test full flow: inactivity → prompt → approval → generation → wind-down
   - Test edge cases: user responds during agent, rapid friend messages
   - Test multiple simultaneous conversations

3. **Manual Testing Scenarios**
   ```
   Scenario 1: Happy Path
   - Start conversation with friend
   - Stop responding for 2+ minutes
   - Receive agent prompt
   - Reply "take over"
   - Verify agent sends 2-3 natural messages
   - Verify agent winds down gracefully

   Scenario 2: User Denial
   - Inactivity triggers prompt
   - Reply "no" or "nope"
   - Verify agent does not activate

   Scenario 3: User Takes Back Control
   - Agent is active
   - User sends message
   - Verify agent aborts immediately

   Scenario 4: Friend No Response
   - Agent sends message
   - Friend doesn't respond for 1 minute
   - Verify agent winds down

   Scenario 5: Multiple Conversations
   - Inactive in 2+ conversations
   - Verify agent handles each separately
   - Verify no cross-contamination of context
   ```

4. **Style Matching Validation**
   - Manually review generated messages
   - Compare to user's actual messages
   - Adjust style analysis if needed
   - Test with different user types (formal, casual, emoji-heavy, etc.)

---

## Configuration & Environment

### Environment Variables (.env)
```bash
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Agent Configuration
INACTIVITY_THRESHOLD_MS=120000  # 2 minutes
MAX_AGENT_MESSAGES=3
STYLE_ANALYSIS_MESSAGE_COUNT=50
TIMER_CHECK_INTERVAL_MS=30000   # Check every 30 seconds

# Debug
DEBUG=true
```

### TypeScript Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

---

## Implementation Sequence

### Week 1: Foundation
1. ✅ Project setup & dependencies
2. ✅ Core types & interfaces
3. ✅ Conversation tracker implementation
4. ✅ Timer manager implementation
5. ✅ Basic watcher integration

### Week 2: Agent Development
1. ✅ Style analyzer tool
2. ✅ Message generator tool
3. ✅ Wind-down detector tool
4. ✅ Main agent definition
5. ✅ Agent testing with mock data

### Week 3: Integration & Flow
1. ✅ Prompt sending logic
2. ✅ Approval parsing
3. ✅ Agent activation
4. ✅ Conversation loop
5. ✅ Wind-down implementation

### Week 4: Polish & Testing
1. ✅ Edge case handling
2. ✅ Error handling
3. ✅ End-to-end testing
4. ✅ Style matching refinement
5. ✅ Documentation

---

## Key Challenges & Solutions

### Challenge 1: Getting User's Own Identifier
**Problem:** Need to send prompts to the user themselves
**Solution:**
- Check iMessage database for the "self" identifier
- Alternative: Configure in .env as `USER_IDENTIFIER=+1234567890`

### Challenge 2: Tracking Messages by ChatId
**Problem:** iMessage SDK may have different chatId formats
**Solution:**
- Use SDK's chatId normalization
- Store both raw and normalized versions
- Match on normalized version

### Challenge 3: Style Matching Accuracy
**Problem:** Simple analysis may not capture nuanced style
**Solution:**
- Use GPT-4o-mini's understanding of style
- Provide extensive examples in prompt
- Include meta-instructions about tone matching
- Iterate based on testing

### Challenge 4: Agent Context Window
**Problem:** Sending 50 messages + conversation history may exceed limits
**Solution:**
- Summarize older messages
- Focus on recent 10-15 messages for conversation
- Use style analysis as compressed guide rather than raw messages

### Challenge 5: Real-time Response Coordination
**Problem:** Need to wait for friend's response before sending next message
**Solution:**
- Implement promise-based response waiting with timeout
- Use SDK watcher with temporary message handler
- Timeout after 60 seconds → wind down

---

## Success Metrics

1. **Functionality**
   - ✅ Detects 2-minute inactivity accurately
   - ✅ Sends prompt with correct friend name
   - ✅ Parses approval correctly (90%+ accuracy)
   - ✅ Generates style-matched messages
   - ✅ Winds down naturally

2. **Style Matching**
   - ✅ Message length within 20% of user average
   - ✅ Tone matches user's typical tone
   - ✅ Emoji usage matches user's patterns
   - ✅ Human evaluators rate messages as "believable" (>80%)

3. **Reliability**
   - ✅ No crashes during operation
   - ✅ Graceful error handling
   - ✅ Proper cleanup on exit
   - ✅ No duplicate messages sent

4. **User Experience**
   - ✅ Prompt is clear and includes friend's name
   - ✅ Agent responds within 2-3 seconds
   - ✅ Wind-down feels natural
   - ✅ User can take back control instantly

---

## Future Enhancements (Post-Demo)

1. **Persistent Storage**
   - SQLite database for conversation history
   - Track patterns over time
   - Remember previous agent interactions

2. **Advanced Style Learning**
   - Use embeddings for semantic style matching
   - Learn per-relationship style (different tone with different friends)
   - Adapt over time with feedback

3. **Conversation Summarization**
   - Provide user with summary of what agent said
   - Allow user to review before sending

4. **Multi-turn Approval**
   - "Preview" mode: show user what agent would send
   - Approve each message individually

5. **Scheduling & Smart Timing**
   - Don't activate during certain hours
   - Respect user's calendar/availability

6. **Integration with Other Platforms**
   - Extend to other messaging platforms
   - Unified agent across all conversations

---

## Notes & Assumptions

1. **macOS Only:** iMessage SDK requires macOS with Full Disk Access
2. **Single User:** Demo assumes single user on the machine
3. **Network Required:** OpenAI API calls require internet
4. **Cost:** GPT-4o-mini is cheap (~$0.15 per 1M input tokens)
5. **Rate Limits:** Respect OpenAI rate limits (3,500 RPM for tier 1)
6. **Privacy:** All message data is local, only style analysis sent to OpenAI
7. **Testing:** Test with friends who consent to AI-generated messages

---

## Getting Started

### Prerequisites
```bash
# macOS with iMessage set up
# Node.js 18+ or Bun 1.0+
# Full Disk Access granted to Terminal/IDE
```

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Add your OPENAI_API_KEY

# 3. Run in development
npm run dev

# 4. Test with a friend
# - Start a conversation
# - Stop responding for 2+ minutes
# - Wait for agent prompt
# - Reply "take over"
# - Watch the magic happen!
```

---

## Documentation References

- **iMessage SDK:** `/imessage-kit.md`
- **Mastra Docs:** https://mastra.ai/docs
- **Mastra Agents:** https://mastra.ai/docs/agents/overview
- **Mastra Tools:** https://mastra.ai/docs/agents/using-tools
- **OpenAI GPT-4o-mini:** https://platform.openai.com/docs/models/gpt-4o-mini

---

**End of Plan**
