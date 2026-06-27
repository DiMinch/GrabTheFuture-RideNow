import { Router, Request, Response } from 'express';

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
router.post('/drivers/location', (req: Request, res: Response) => {
  const { driverId, location, bearing } = req.body;
  if (!driverId || !location) {
    return res.status(400).json({ error: 'driverId and location are required' });
  }

  driverLocations[driverId] = {
    location,
    bearing: bearing || 0,
    updatedAt: new Date().toISOString(),
  };

  return res.json({ success: true, message: 'Driver location updated' });
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
