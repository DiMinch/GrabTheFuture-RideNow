import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import apiRouter from './routes/index.js';
import bookingRouter from './routes/booking.js';

const app = express();

// Load OpenAPI Swagger Document
const openApiDocPath = path.resolve(process.cwd(), '../docs/openapi.yaml');
const swaggerDocument = YAML.load(openApiDocPath);

// Middleware
app.use(cors());
app.use(express.json());

// Swagger UI Docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes - support both with and without /api prefix
app.use('/api/bookings', bookingRouter);
app.use('/bookings', bookingRouter);
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default app;
