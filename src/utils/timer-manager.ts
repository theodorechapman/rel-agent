/**
 * TimerManager - Manages periodic checks for inactive conversations
 */

import type { ConversationState } from '../types/index.js'
import type { ConversationTracker } from '../watchers/conversation-tracker.js'

export class TimerManager {
  private timerId: NodeJS.Timeout | null = null
  private isRunning: boolean = false

  /**
   * Start periodic inactivity checks
   * @param intervalMs How often to check for inactivity (e.g., 30000 = 30 seconds)
   * @param inactivityThresholdMs Minimum inactivity time to trigger (e.g., 120000 = 2 minutes)
   * @param maxInactivityMs Maximum inactivity time (e.g., 3600000 = 1 hour)
   * @param tracker The conversation tracker to query
   * @param callback Function to call for each inactive conversation
   */
  startInactivityCheck(
    intervalMs: number,
    inactivityThresholdMs: number,
    maxInactivityMs: number,
    tracker: ConversationTracker,
    callback: (conv: ConversationState) => Promise<void>,
    userIdentifier?: string
  ): void {
    if (this.isRunning) {
      console.warn('[TimerManager] Inactivity check already running')
      return
    }

    this.isRunning = true

    console.log(`[TimerManager] Starting inactivity checks every ${intervalMs / 1000}s`)

    this.timerId = setInterval(async () => {
      const inactiveConversations = tracker.getInactiveConversations(
        inactivityThresholdMs,
        maxInactivityMs,
        userIdentifier
      )

      if (inactiveConversations.length > 0) {
        console.log(
          `[TimerManager] Found ${inactiveConversations.length} inactive conversation(s)`
        )
      }

      for (const conv of inactiveConversations) {
        try {
          await callback(conv)
        } catch (error) {
          console.error(`[TimerManager] Error processing inactive conversation ${conv.chatId}:`, error)
        }
      }
    }, intervalMs)
  }

  /**
   * Stop the inactivity check timer
   */
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
      this.isRunning = false
      console.log('[TimerManager] Stopped inactivity checks')
    }
  }

  /**
   * Check if the timer is currently running
   */
  getIsRunning(): boolean {
    return this.isRunning
  }
}
