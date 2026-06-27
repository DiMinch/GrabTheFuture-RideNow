import { getDb } from '../config/firebase.js';

async function check() {
  try {
    const db = getDb();
    console.log('[Diagnostic] Querying drivers...');
    const snapshot = await db.collection('drivers').get();
    console.log(`[Diagnostic] Total drivers found: ${snapshot.size}`);
    snapshot.forEach(doc => {
      console.log(`- Driver ID: ${doc.id}, busy: ${doc.data().busy}, name: ${doc.data().name}`);
    });
    process.exit(0);
  } catch (error) {
    console.error('[Diagnostic] Error:', error);
    process.exit(1);
  }
}

check();
