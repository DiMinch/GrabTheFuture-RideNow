import express, { Request, Response } from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';
import bookingRouter from './routes/booking.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/bookings', bookingRouter);
app.use('/', apiRouter);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default app;
