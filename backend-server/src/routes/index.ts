import { Router, Request, Response } from 'express';
import { getDb } from '../config/firebase.js';

const router = Router();

// Mock database in memory
let bookings: any[] = [];
let driverLocations: Record<string, any> = {};

// 1. Auth Endpoint
router.post('/auth/verify', (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'Missing idToken' });
  }
  // Mock validation
  return res.json({
    id: 'mock-user-123',
    name: 'Nguyen Van A',
    phoneNumber: '+84901234567',
    role: 'RIDER',
    createdAt: new Date().toISOString(),
  });
});
// 5. Driver Location Update
router.post('/drivers/location', async (req: Request, res: Response) => {
  try {
    const { driverId, location, bearing } = req.body;
    if (!driverId || !location) {
      return res.status(400).json({ error: 'driverId and location are required' });
    }

    // 1. Cập nhật vị trí tài xế trong Firestore (bảng drivers)
    await getDb().collection('drivers').doc(driverId).set({
      latitude: location.latitude,
      longitude: location.longitude,
      bearing: bearing || 0,
      updatedAt: new Date()
    }, { merge: true });

    // 2. Tìm tất cả cuốc xe đang chạy của tài xế này để cập nhật tọa độ GPS realtime vào Booking doc
    const activeBookingsSnapshot = await getDb().collection('bookings')
      .where('driverId', '==', driverId)
      .where('status', 'in', [
        'pending', 'accepted', 'in_progress', 'arrived',
        'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED'
      ])
      .get();

    if (!activeBookingsSnapshot.empty) {
      const batch = getDb().batch();
      activeBookingsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          'driver.lat': location.latitude,
          'driver.lng': location.longitude,
          'driver.bearing': bearing || 0,
          updatedAt: new Date()
        });
      });
      await batch.commit();
    }

    return res.json({ success: true, message: 'Driver location updated in Firestore' });
  } catch (error) {
    console.error('Error updating driver location:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Get Driver Beacon metadata
router.get('/drivers/:driverId/beacon', (req: Request, res: Response) => {
  const { driverId } = req.params;
  // Mock returns characteristic BLE properties for the driver
  return res.json({
    driverId,
    uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0', // Standard AltBeacon/iBeacon format
    major: 1,
    minor: 102,
  });
});

export default router;
