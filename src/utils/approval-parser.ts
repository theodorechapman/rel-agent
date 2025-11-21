/**
 * Approval Parser - Determines if user message is approval or denial
 */

const APPROVAL_KEYWORDS = [
  'take over',
  'yes',
  'yeah',
  'yep',
  'sure',
  'ok',
  'okay',
  'do it',
  'go ahead',
  'please',
  'yea',
  'ye',
  'ya',
  'k'
]

const DENIAL_KEYWORDS = [
  'no',
  'nope',
  "don't",
  'dont',
  'cancel',
  'nevermind',
  'never mind',
  'nah',
  'stop',
  'not now',
  'later'
]

/**
 * Check if a message text indicates user approval
 */
export function isApproval(messageText: string): boolean {
  const normalized = messageText.toLowerCase().trim()
  return APPROVAL_KEYWORDS.some(keyword => normalized.includes(keyword))
}

/**
 * Check if a message text indicates user denial
 */
export function isDenial(messageText: string): boolean {
  const normalized = messageText.toLowerCase().trim()
  return DENIAL_KEYWORDS.some(keyword => normalized.includes(keyword))
}

/**
 * Parse user response to determine intent
 * Returns: 'approve' | 'deny' | 'unclear'
 */
export function parseUserResponse(messageText: string): 'approve' | 'deny' | 'unclear' {
  if (isApproval(messageText)) {
    return 'approve'
  }

  if (isDenial(messageText)) {
    return 'deny'
  }

  return 'unclear'
}
