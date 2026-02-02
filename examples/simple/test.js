// Quick test to verify imports work
import * as Sentry from '../../dist/index.js';
import { getLocalLogs, clearLocalData } from '../../dist/index.js';

console.log('✓ Imports successful!');
console.log('✓ Sentry object:', typeof Sentry);
console.log('✓ getLocalLogs:', typeof getLocalLogs);
console.log('✓ clearLocalData:', typeof clearLocalData);

// Test initialization
Sentry.init({
  debug: true,
  environment: 'test',
});

console.log('✓ Sentry.init() successful!');

// Test capture
const eventId = Sentry.captureMessage('Test message', 'info');
console.log('✓ Captured test message, event ID:', eventId);

// Test getting logs
setTimeout(async () => {
  const logs = await getLocalLogs();
  console.log('✓ Retrieved logs:', logs?.length || 0, 'entries');
  process.exit(0);
}, 100);
