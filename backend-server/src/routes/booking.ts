// src/routes/bookings.ts
import { Router, Request, Response } from 'express';
import { getDb } from '../config/firebase.js'; // Import db từ cấu hình
import { findBestDriver } from '../services/matching.js'; // Import service của bạn
import { Booking } from '../types/index.js'; // Import các type đã tạo

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    try {
        const { riderId, pickupLocation, dropoffLocation, accessibilityMode } = req.body;

        // 1. Lấy danh sách tài xế đang rảnh từ Firestore
        const driversSnapshot = await getDb().collection('drivers')
            .where('busy', '==', false)
            .get();

        const drivers = driversSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as any[]; // Hoặc ép kiểu Driver[] từ types/index.ts

        // 2. Tìm tài xế tốt nhất bằng service bạn đã viết
        const bestDriver = findBestDriver(drivers, pickupLocation) as any;

        if (!bestDriver) {
            return res.status(404).json({ success: false, message: 'No driver available' });
        }

        // 3. Tạo record Booking mới trong Firestore
        const newBooking: Booking = {
            riderId: riderId || 'mock-user-123',
            pickupLocation,
            dropoffLocation,
            accessibilityMode: accessibilityMode !== false,
            status: 'pending',
            driverId: bestDriver.id,
            createdAt: new Date(),
            rider: {
                lat: pickupLocation.latitude,
                lng: pickupLocation.longitude,
                signal_tapped: false
            },
            driver: {
                name: bestDriver.name || 'Nguyễn Văn A',
                plate: bestDriver.plate || '59X3-1234',
                ble_major_minor: bestDriver.ble_major_minor || '12345-67890',
                lat: bestDriver.latitude,
                lng: bestDriver.longitude
            }
        };

        const docRef = await getDb().collection('bookings').add(newBooking);

        // Đánh dấu tài xế bận trong Firestore để tránh bị khớp cuốc trùng lặp
        await getDb().collection('drivers').doc(bestDriver.id).update({
            busy: true,
            updatedAt: new Date()
        });

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

        // Đánh dấu tài xế bận
        await getDb().collection('drivers').doc(driverId).update({
            busy: true,
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
        const doc = await docRef.get();

        if (doc.exists) {
            const bookingData = doc.data() as Booking;
            // Giải phóng tài xế nếu có gắn kết
            if (bookingData.driverId) {
                await getDb().collection('drivers').doc(bookingData.driverId).update({
                    busy: false,
                    updatedAt: new Date()
                });
            }
        }
        
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

// Bổ sung 4: API Cập nhật trạng thái tổng quát (PATCH cho OpenAPI)
router.patch('/:id/status', async (req: Request, res: Response) => {
    try {
        const { status, driverId } = req.body;
        const docRef = getDb().collection('bookings').doc(req.params.id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const bookingData = doc.data() as Booking;
        const activeDriverId = driverId || bookingData.driverId;

        const updates: any = {
            status,
            updatedAt: new Date()
        };

        if (driverId !== undefined) {
            updates.driverId = driverId;
        }

        await docRef.update(updates);

        // Giải phóng tài xế nếu cuốc xe hoàn thành hoặc bị huỷ
        if (activeDriverId && (status === 'completed' || status === 'cancelled')) {
            await getDb().collection('drivers').doc(activeDriverId).update({
                busy: false,
                updatedAt: new Date()
            });
        } else if (activeDriverId && (status === 'accepted' || status === 'in_progress')) {
            // Đánh dấu bận nếu tài xế nhận hoặc đang chạy cuốc
            await getDb().collection('drivers').doc(activeDriverId).update({
                busy: true,
                updatedAt: new Date()
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Booking status updated successfully',
            data: { id: req.params.id, ...bookingData, ...updates }
        });
    } catch (error) {
        console.error('Error patching booking status:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export default router;