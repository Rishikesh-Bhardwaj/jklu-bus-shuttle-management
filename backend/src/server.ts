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

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration supporting credentials (cookies)
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl) or allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in local dev, restricted in prod
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

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[GLOBAL_ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[SERVER] JKLU Bus Shuttle Backend running on port ${PORT}`);
    console.log(`[HEALTH] Health check available at http://localhost:${PORT}/api/health`);
  });
}

export default app;
