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

// 2. Create Booking
router.post('/bookings', (req: Request, res: Response) => {
  const { pickupLocation, dropoffLocation, pickupAddress, dropoffAddress } = req.body;
  if (!pickupLocation || !dropoffLocation) {
    return res.status(400).json({ error: 'Pickup and dropoff locations are required' });
  }

  const newBooking = {
    id: `booking-${Math.random().toString(36).substr(2, 9)}`,
    riderId: 'mock-user-123',
    driverId: null,
    pickupLocation,
    dropoffLocation,
    pickupAddress: pickupAddress || 'Selected Pickup Point',
    dropoffAddress: dropoffAddress || 'Selected Dropoff Point',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  bookings.push(newBooking);
  return res.status(201).json(newBooking);
});

// 3. Get Booking Details
router.get('/bookings/:bookingId', (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  return res.json(booking);
});

// 4. Update Booking Status
router.patch('/bookings/:bookingId/status', (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { status, driverId } = req.body;

  const bookingIndex = bookings.findIndex((b) => b.id === bookingId);
  if (bookingIndex === -1) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  bookings[bookingIndex] = {
    ...bookings[bookingIndex],
    status,
    driverId: driverId || bookings[bookingIndex].driverId,
    updatedAt: new Date().toISOString(),
  };

  return res.json(bookings[bookingIndex]);
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
