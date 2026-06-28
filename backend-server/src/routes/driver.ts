import { Router, Request, Response } from 'express';
import { getDb } from '../config/firebase.js';

const router = Router();

// 1. List all drivers
router.get('/', async (req: Request, res: Response) => {
    try {
        const driversSnapshot = await getDb().collection('drivers').get();
        const drivers = driversSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        res.status(200).json({ success: true, data: drivers });
    } catch (error) {
        console.error('Error fetching drivers:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// 2. Create a new driver
router.post('/', async (req: Request, res: Response) => {
    try {
        const { name, plate, ble_major_minor, latitude, longitude, busy, accessibilityFriendly, rating } = req.body;
        
        if (!name || !plate) {
            return res.status(400).json({ success: false, message: 'Name and plate are required' });
        }

        const newDriver = {
            name,
            plate,
            ble_major_minor: ble_major_minor || 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0:1:100',
            latitude: Number(latitude) || 10.8756,
            longitude: Number(longitude) || 106.8007,
            busy: busy === true,
            accessibilityFriendly: accessibilityFriendly === true,
            rating: Number(rating) || 5.0,
            updatedAt: new Date()
        };

        const docRef = await getDb().collection('drivers').add(newDriver);
        res.status(201).json({ success: true, data: { id: docRef.id, ...newDriver } });
    } catch (error) {
        console.error('Error creating driver:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// 3. Update an existing driver
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates: any = {};
        
        const fields = ['name', 'plate', 'ble_major_minor', 'latitude', 'longitude', 'busy', 'accessibilityFriendly', 'rating'];
        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'latitude' || field === 'longitude' || field === 'rating') {
                    updates[field] = Number(req.body[field]);
                } else {
                    updates[field] = req.body[field];
                }
            }
        });
        
        updates.updatedAt = new Date();

        await getDb().collection('drivers').doc(id).update(updates);
        res.status(200).json({ success: true, message: 'Driver updated successfully' });
    } catch (error) {
        console.error('Error updating driver:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// 4. Delete a driver
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await getDb().collection('drivers').doc(id).delete();
        res.status(200).json({ success: true, message: 'Driver deleted successfully' });
    } catch (error) {
        console.error('Error deleting driver:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// 5. Trigger database seeding (Reset drivers and clear bookings)
router.post('/seed', async (req: Request, res: Response) => {
    try {
        const db = getDb();
        console.log('[Dashboard API] Re-seeding drivers...');

        // Clear existing drivers
        const driversSnapshot = await db.collection('drivers').get();
        const driverBatch = db.batch();
        driversSnapshot.docs.forEach(doc => driverBatch.delete(doc.ref));
        await driverBatch.commit();

        // Clear bookings to start clean
        const bookingsSnapshot = await db.collection('bookings').get();
        const bookingBatch = db.batch();
        bookingsSnapshot.docs.forEach(doc => bookingBatch.delete(doc.ref));
        await bookingBatch.commit();

        // Add fresh mock drivers
        const mockDrivers = [
            {
                name: 'Nguyen Van Binh',
                plate: '59P1-99999',
                ble_major_minor: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0:1:101',
                latitude: 10.8756,
                longitude: 106.8007,
                busy: false,
                accessibilityFriendly: true,
                rating: 4.9,
                updatedAt: new Date()
            },
            {
                name: 'Tran Van An',
                plate: '59A2-88888',
                ble_major_minor: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0:1:102',
                latitude: 10.8790,
                longitude: 106.8030,
                busy: false,
                accessibilityFriendly: false,
                rating: 4.7,
                updatedAt: new Date()
            },
            {
                name: 'Le Thi Hoa',
                plate: '59P2-77777',
                ble_major_minor: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0:1:103',
                latitude: 10.8700,
                longitude: 106.7980,
                busy: true,
                accessibilityFriendly: true,
                rating: 4.8,
                updatedAt: new Date()
            }
        ];

        const addPromises = mockDrivers.map((d, index) => {
            const id = `driver-mock-${index + 1}`;
            return db.collection('drivers').doc(id).set(d);
        });
        await Promise.all(addPromises);

        res.status(200).json({ success: true, message: 'Database re-seeded successfully' });
    } catch (error) {
        console.error('Error re-seeding database:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export default router;
