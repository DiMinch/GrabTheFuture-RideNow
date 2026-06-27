import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import app from './server.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// WebSocket Setup for Real-time location tracking & Tap-to-Signal
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);

  // Driver registers location stream room
  socket.on('join_booking', (bookingId: string) => {
    socket.join(bookingId);
    console.log(`[Socket] Client joined booking room: ${bookingId}`);
  });

  // Location Updates
  socket.on('driver_location_update', (data: { bookingId: string; latitude: number; longitude: number; bearing: number }) => {
    // Broadcast location to all clients (e.g. Riders) in the booking room
    socket.to(data.bookingId).emit('location_update', data);
  });

  // Tap-to-Signal WebSocket Event
  socket.on('tap_to_signal', (data: { bookingId: string; message: string }) => {
    console.log(`[Socket] Tap-to-Signal received for booking ${data.bookingId}: ${data.message}`);
    // Emit warning alert to driver
    socket.to(data.bookingId).emit('driver_alert_tap', data);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
