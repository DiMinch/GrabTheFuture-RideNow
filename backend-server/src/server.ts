import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import apiRouter from './routes/index.js';
import bookingRouter from './routes/booking.js';
import driverRouter from './routes/driver.js';

const app = express();

// Load OpenAPI Swagger Document with multiple fallback paths
let openApiDocPath = path.resolve(process.cwd(), '../docs/openapi.yaml');
if (!fs.existsSync(openApiDocPath)) {
  openApiDocPath = path.resolve(process.cwd(), 'docs/openapi.yaml');
}
if (!fs.existsSync(openApiDocPath)) {
  openApiDocPath = path.resolve(process.cwd(), 'openapi.yaml');
}

let swaggerDocument: any;
try {
  if (fs.existsSync(openApiDocPath)) {
    swaggerDocument = YAML.load(openApiDocPath);
  } else {
    throw new Error(`OpenAPI spec file not found at ${openApiDocPath}`);
  }
} catch (err) {
  console.warn(`[RideNow] Warning: Could not load OpenAPI specification:`, err);
  swaggerDocument = {
    openapi: '3.0.0',
    info: {
      title: 'RideNow API',
      version: '1.0.0',
      description: 'API spec fallback (original file missing)'
    },
    paths: {}
  };
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static dashboard files
app.use('/dashboard', express.static(path.resolve(process.cwd(), 'public')));

// Swagger UI Docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes - support both with and without /api prefix
app.use('/api/bookings', bookingRouter);
app.use('/bookings', bookingRouter);
app.use('/api/drivers', driverRouter);
app.use('/drivers', driverRouter);
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default app;
