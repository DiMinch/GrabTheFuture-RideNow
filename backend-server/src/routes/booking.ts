// src/routes/bookings.ts
import { Router, Request, Response } from 'express';
import { getDb } from '../config/firebase.js'; // Import db từ cấu hình
import { findBestDriver } from '../services/matching.js'; // Import service của bạn
import { Booking } from '../types/index.js'; // Import các type đã tạo

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    try {
        const { riderId, pickupLocation, destinationLocation, accessibilityMode } = req.body;

        // 1. Lấy danh sách tài xế đang rảnh từ Firestore
        const driversSnapshot = await getDb().collection('drivers')
            .where('busy', '==', false)
            .get();

        const drivers = driversSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as any[]; // Hoặc ép kiểu Driver[] từ types/index.ts

        // 2. Tìm tài xế tốt nhất bằng service bạn đã viết
        const bestDriver = findBestDriver(drivers, pickupLocation);

        if (!bestDriver) {
            return res.status(404).json({ success: false, message: 'No driver available' });
        }

        // 3. Tạo record Booking mới trong Firestore
        const newBooking: Booking = {
            riderId,
            pickupLocation,
            destinationLocation,
            accessibilityMode,
            status: 'pending',
            driverId: bestDriver.id,
            createdAt: new Date(),
        };

        const docRef = await getDb().collection('bookings').add(newBooking);

        // 4. Trả kết quả
        res.status(201).json({ 
            success: true, 
            data: { id: docRef.id, ...newBooking } 
        });

    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Bổ sung 1: API lấy thông tin chi tiết của một cuốc xe
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const docRef = getDb().collection('bookings').doc(req.params.id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        res.status(200).json({ 
            success: true, 
            data: { id: doc.id, ...doc.data() } 
        });
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Bổ sung 2: API Tài xế nhận cuốc xe
router.put('/:id/accept', async (req: Request, res: Response) => {
    try {
        const { driverId } = req.body;

        if (!driverId) {
            return res.status(400).json({ success: false, message: 'Driver ID is required' });
        }

        const docRef = getDb().collection('bookings').doc(req.params.id);
        
        // Cập nhật trạng thái và gắn ID tài xế
        await docRef.update({
            status: 'accepted',
            driverId: driverId,
            updatedAt: new Date()
        });

        res.status(200).json({ success: true, message: 'Booking accepted successfully' });
    } catch (error) {
        console.error('Error accepting booking:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Bổ sung 3: API Hủy cuốc xe
router.put('/:id/cancel', async (req: Request, res: Response) => {
    try {
        const docRef = getDb().collection('bookings').doc(req.params.id);
        
        // Cập nhật trạng thái thành cancelled
        await docRef.update({
            status: 'cancelled',
            updatedAt: new Date()
        });

        res.status(200).json({ success: true, message: 'Booking cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
export default router;