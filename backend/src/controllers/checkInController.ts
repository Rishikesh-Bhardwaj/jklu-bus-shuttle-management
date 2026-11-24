import { Request, Response } from 'express';
import { pool } from '../config/db.js';

/**
 * GET /api/check-ins/manifest/:tripId
 * MANAGER only: Retrieve passenger manifest for a trip.
 */
export async function getTripManifest(req: Request, res: Response): Promise<void> {
  try {
    const tripId = parseInt(req.params.tripId, 10);

    const [rows]: any = await pool.query(
      `SELECT ci.booking_id, ci.boarding_status, ci.boarded_at, ci.updated_at,
              b.user_id, b.booking_status, b.booking_time,
              u.full_name AS passenger_name, u.email AS passenger_email, u.phone_number AS passenger_phone,
              u.role AS passenger_role, u.student_category,
              s.seat_number,
              st.stop_name AS boarding_stop_name,
              m.full_name AS marked_by_name
       FROM bookings b
       JOIN check_ins ci ON b.booking_id = ci.booking_id
       JOIN users u ON b.user_id = u.user_id
       JOIN seats s ON b.seat_id = s.seat_id
       JOIN stops st ON b.boarding_stop_id = st.stop_id
       LEFT JOIN users m ON ci.marked_by_user_id = m.user_id
       WHERE b.trip_id = ?
       ORDER BY CAST(s.seat_number AS UNSIGNED) ASC, s.seat_number ASC`,
      [tripId]
    );

    const summary = {
      totalBooked: rows.length,
      boarded: rows.filter((r: any) => r.boarding_status === 'BOARDED').length,
      notCheckedIn: rows.filter((r: any) => r.boarding_status === 'NOT_CHECKED_IN').length,
      noShow: rows.filter((r: any) => r.boarding_status === 'NO_SHOW').length,
      cancelledPrior: rows.filter((r: any) => r.boarding_status === 'CANCELLED_PRIOR').length,
    };

    res.json({ manifest: rows, summary });
  } catch (error: any) {
    console.error('[TRIP_MANIFEST_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve passenger manifest.' });
  }
}

/**
 * POST /api/check-ins/:bookingId/board
 * MANAGER only: Mark passenger as BOARDED.
 */
export async function markPassengerBoarded(req: Request, res: Response): Promise<void> {
  try {
    const bookingId = parseInt(req.params.bookingId, 10);
    const managerUserId = req.user!.userId;

    const [existing]: any = await pool.query(
      `SELECT ci.boarding_status, b.booking_status, t.trip_status
       FROM check_ins ci
       JOIN bookings b ON ci.booking_id = b.booking_id
       JOIN trips t ON b.trip_id = t.trip_id
       WHERE ci.booking_id = ?`,
      [bookingId]
    );

    if (existing.length === 0) {
      res.status(404).json({ error: 'Check-in record not found for this booking.' });
      return;
    }

    if (existing[0].trip_status === 'CANCELLED') {
      res.status(400).json({ error: 'Cannot check in a passenger for a cancelled trip.' });
      return;
    }

    if (existing[0].boarding_status === 'BOARDED') {
      res.status(400).json({ error: 'Passenger has already been checked in / boarded.' });
      return;
    }

    if (existing[0].boarding_status === 'CANCELLED_PRIOR' || existing[0].booking_status === 'CANCELLED') {
      res.status(400).json({ error: 'Cannot check in a passenger whose booking was cancelled.' });
      return;
    }

    await pool.query(
      `UPDATE check_ins
       SET boarding_status = 'BOARDED',
           boarded_at = CURRENT_TIMESTAMP,
           marked_by_user_id = ?
       WHERE booking_id = ?`,
      [managerUserId, bookingId]
    );

    res.json({
      message: 'Passenger boarded successfully.',
      bookingId,
      status: 'BOARDED',
    });
  } catch (error: any) {
    console.error('[CHECKIN_BOARD_ERROR]', error);
    res.status(500).json({ error: 'Failed to mark passenger boarded.' });
  }
}

/**
 * POST /api/check-ins/:bookingId/no-show
 * MANAGER only: Mark passenger as NO_SHOW.
 */
export async function markPassengerNoShow(req: Request, res: Response): Promise<void> {
  try {
    const bookingId = parseInt(req.params.bookingId, 10);
    const managerUserId = req.user!.userId;

    const [existing]: any = await pool.query(
      `SELECT ci.boarding_status, b.booking_status, t.trip_status
       FROM check_ins ci
       JOIN bookings b ON ci.booking_id = b.booking_id
       JOIN trips t ON b.trip_id = t.trip_id
       WHERE ci.booking_id = ?`,
      [bookingId]
    );

    if (existing.length === 0) {
      res.status(404).json({ error: 'Check-in record not found for this booking.' });
      return;
    }

    if (existing[0].trip_status === 'CANCELLED') {
      res.status(400).json({ error: 'Cannot mark no-show for a cancelled trip.' });
      return;
    }

    if (existing[0].boarding_status === 'CANCELLED_PRIOR' || existing[0].booking_status === 'CANCELLED') {
      res.status(400).json({ error: 'Cannot mark cancelled booking as no-show.' });
      return;
    }

    await pool.query(
      `UPDATE check_ins
       SET boarding_status = 'NO_SHOW',
           marked_by_user_id = ?
       WHERE booking_id = ?`,
      [managerUserId, bookingId]
    );

    res.json({
      message: 'Passenger marked as NO_SHOW.',
      bookingId,
      status: 'NO_SHOW',
    });
  } catch (error: any) {
    console.error('[CHECKIN_NOSHOW_ERROR]', error);
    res.status(500).json({ error: 'Failed to update passenger status.' });
  }
}

