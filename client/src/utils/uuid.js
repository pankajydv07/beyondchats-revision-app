// UUID generation utility for client-side
export function generateUUID() {
  // Simple UUID v4 generation for client-side use
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Alternative: Using crypto.randomUUID if available (modern browsers)
export function generateSecureUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback to the simple implementation
  return generateUUID();
}