Here’s a clean, simple **Product Requirements Document (PRD)** for your iMessage “Relationship Agent” demo using Mastra’s AI agent framework + the new iMessage SDK.

---

# **Product Requirements Document (PRD)**

## **Project: Relationship Agent iMessage Demo**

---

## **1. Overview**

The **Relationship Agent** is an iMessage-integrated AI assistant that monitors user conversations and provides conversational support when the user becomes unresponsive. After detecting inactivity (>2 minutes), the agent proactively checks in with the user and, if instructed, continues the conversation in the user’s style before gracefully winding it down.
This demo showcases:

* Real-time conversational monitoring
* Autonomous messaging using Mastra AI agents
* Interaction through the new iMessage SDK

---

## **2. Goals & Objectives**

### **Primary Goals**

* Demonstrate Mastra’s AI agent framework in a real-time, user-facing scenario.
* Showcase autonomous message handling via the new iMessage SDK.
* Highlight personalized, style-consistent message generation.

### **Success Criteria**

* Agent accurately detects >2 minutes of no response.
* Agent sends a prompt message containing the friend’s name.
* Agent can generate style-matched responses.
* Agent can “wind down” conversations appropriately (e.g., polite wrap-up, soft exit).

---

## **3. User Stories**

### **Core User Stories**

* **As a user**, I want the agent to notify me when I haven’t responded in a while so I don’t accidentally ghost someone.
* **As a user**, I want the agent to ask if I want it to take over.
* **As a user**, I want the agent to text in a tone similar to mine.
* **As a user**, I want the agent to gracefully conclude conversations so interactions feel natural and non-abrupt.

### **Extended User Stories (optional for later)**

* As a user, I want to preview how the agent rewrites my style.
* As a user, I want the agent to summarize past conversation context.

---

## **4. User Flow**

1. **User is in a conversation** with a friend on iMessage.
2. **Inactivity timer starts** after user’s last outgoing message.
3. At **2 minutes of silence**, the agent triggers a check-in message:

   > “Hey, are you trying to ghost *[Friend Name]* or do you want me to take over?”
4. **User chooses**:

   * *Ignore →* agent does nothing.
   * *Respond “take over” →* agent assumes control.
5. **Agent sends messages** mimicking user style.
6. Agent identifies a natural stopping point and **winds down the conversation**, e.g.:

   > “Anyway, I’m heading out but talk soon!”
7. Agent then **hands control back** to the user.

---

## **5. Functional Requirements**

### **5.1 Conversation Monitoring**

* Must detect last outgoing user message timestamp.
* Must check for >2 minutes of inactivity.
* Must access conversation metadata (friend names, message IDs).

### **5.2 Agent Prompt Trigger**

* Agent generates a system message asking the user if they want help.
* Message must include friend’s name extracted from the conversation.

### **5.3 AI Response Generation**

* Use Mastra’s agent framework to:

  * Load recent message context.
  * Infer user tone from past messages.
  * Generate a reply consistent with user’s style.
  * Detect when the conversation is naturally winding down.

### **5.4 iMessage SDK Integration**

* Must support:

  * Sending messages programmatically
  * Reading conversation threads
  * Tracking timestamps
  * Identifying sender/recipient
* Must handle permissions and user authorization.

### **5.5 Safety & Boundaries**

* The agent should:

  * Avoid sending sensitive or inappropriate content.
  * Avoid escalating emotionally charged conversations.
  * Allow user to revoke autonomy at any time.

---

## **6. Non-Functional Requirements**

### **Performance**

* Response generation should occur within 1–2 seconds for live-feel.
* Inactivity detection should run lightweight and event-driven.

### **Reliability**

* Must handle scenarios where message data is incomplete.
* Should degrade gracefully (e.g., fail silently if unable to read thread).

### **Privacy**

* All processing should remain on-device or secure backend (depending on architecture).
* Only process conversations the user explicitly grants access to.

---

## **7. Technical Architecture**

### **Components**

* **Mastra Agent**

  * Handles conversation logic, style simulation, wind-down heuristics.

* **iMessage SDK Wrapper**

  * Listens for outgoing user messages.
  * Triggers callbacks on inactivity.
  * Sends agent-generated messages.

* **Context Manager**

  * Maintains rolling window of latest messages.
  * Provides tone/style embeddings.

### **Flow Diagram (simple)**

User message → reset inactivity timer
↓
Timer hits 2 minutes → agent sends prompt
↓
User opts in → agent generates style-matched message
↓
Agent tracks conversation → winds down → exits

---

## **8. Edge Cases**

* User responds while agent is drafting → abort agent message.
* Friend sends rapid messages → agent should wait a bit to respond.
* Long gaps (hours) → agent does NOT retroactively trigger.
