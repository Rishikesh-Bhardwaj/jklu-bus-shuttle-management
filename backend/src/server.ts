import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { verifyDatabaseConnection } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import verificationRoutes from './routes/verificationRoutes.js';
import fleetRoutes from './routes/fleetRoutes.js';
import routeRoutes from './routes/routeRoutes.js';
import tripRoutes from './routes/tripRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import checkInRoutes from './routes/checkInRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy (Railway) for secure HTTPS cookies and client IP resolution
app.set('trust proxy', 1);

// CORS configuration supporting credentials (cookies)
const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((url) => url.trim().replace(/\/$/, ''))
  : [];

const localDevOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const allowedOrigins: string[] = [
  ...configuredOrigins,
  ...(process.env.NODE_ENV !== 'production' ? localDevOrigins : []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl) or allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const dbStatus = await verifyDatabaseConnection();
    res.json({
      status: 'healthy',
      service: 'JKLU Bus Shuttle Management API',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'JKLU Bus Shuttle Management API',
      error: error.message,
    });
  }
});

// Mount modular API routers
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/check-ins', checkInRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/resources', resourceRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[GLOBAL_ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[SERVER] JKLU Bus Shuttle Backend running on 0.0.0.0:${PORT}`);
    console.log(`[HEALTH] Health check available at http://localhost:${PORT}/api/health`);
  });
}

export default app;
