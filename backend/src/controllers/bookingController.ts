import { Request, Response } from 'express';
import { pool } from '../config/db.js';

/**
 * POST /api/bookings
 * Verified users: Reserve a seat on a shuttle trip with atomic concurrency locks.
 */
export async function createBooking(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { tripId, seatId, boardingStopId } = req.body;

  if (!tripId || !seatId || !boardingStopId) {
    res.status(400).json({ error: 'tripId, seatId, and boardingStopId are required.' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch trip and verify status
    const [trips]: any = await connection.query(
      `SELECT trip_id, route_id, bus_id, direction, trip_date, departure_time, trip_status
       FROM trips
       WHERE trip_id = ? FOR UPDATE`,
      [tripId]
    );

    if (trips.length === 0) {
      await connection.rollback();
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }

    const trip = trips[0];
    if (trip.trip_status !== 'PUBLISHED') {
      await connection.rollback();
      res.status(400).json({
        error: `Only PUBLISHED trips are open for seat reservations. Current status: ${trip.trip_status}.`,
      });
      return;
    }

    // 2. Verify boarding stop belongs to the trip's route
    const [stopCheck]: any = await connection.query(
      `SELECT route_stop_id FROM route_stops WHERE route_id = ? AND stop_id = ?`,
      [trip.route_id, boardingStopId]
    );

    if (stopCheck.length === 0) {
      await connection.rollback();
      res.status(400).json({ error: 'Selected boarding stop does not belong to this route.' });
      return;
    }

    // 3. Verify seat belongs to the bus assigned to this trip
    const [seatCheck]: any = await connection.query(
      `SELECT seat_id, bus_id, seat_number FROM seats WHERE seat_id = ? AND bus_id = ?`,
      [seatId, trip.bus_id]
    );

    if (seatCheck.length === 0) {
      await connection.rollback();
      res.status(400).json({ error: 'Selected seat does not belong to the bus assigned to this trip.' });
      return;
    }

    // 4. Concurrency check: Ensure user does not already hold a seat on this trip
    const [userResCheck]: any = await connection.query(
      `SELECT reservation_id FROM trip_seat_reservations WHERE trip_id = ? AND user_id = ? FOR UPDATE`,
      [tripId, userId]
    );

    if (userResCheck.length > 0) {
      await connection.rollback();
      res.status(400).json({ error: 'You already hold an active seat reservation for this trip.' });
      return;
    }

    // 5. Concurrency check: Ensure seat is not already reserved by another user
    const [seatResCheck]: any = await connection.query(
      `SELECT reservation_id FROM trip_seat_reservations WHERE trip_id = ? AND seat_id = ? FOR UPDATE`,
      [tripId, seatId]
    );

    if (seatResCheck.length > 0) {
      await connection.rollback();
      res.status(409).json({ error: 'This seat was just reserved by another passenger. Please select another seat.' });
      return;
    }

    // 6. Insert booking record
    const [bookingResult]: any = await connection.query(
      `INSERT INTO bookings (user_id, trip_id, route_id, seat_id, boarding_stop_id, booking_status)
       VALUES (?, ?, ?, ?, ?, 'CONFIRMED')`,
      [userId, tripId, trip.route_id, seatId, boardingStopId]
    );

    const bookingId = bookingResult.insertId;

    // 7. Insert seat reservation lock
    await connection.query(
      `INSERT INTO trip_seat_reservations (booking_id, trip_id, user_id, seat_id, bus_id)
       VALUES (?, ?, ?, ?, ?)`,
      [bookingId, tripId, userId, seatId, trip.bus_id]
    );

    // 8. Initialize passenger boarding check-in record
    await connection.query(
      `INSERT INTO check_ins (booking_id, boarding_status)
       VALUES (?, 'NOT_CHECKED_IN')`,
      [bookingId]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Seat successfully reserved.',
      booking: {
        bookingId,
        tripId,
        seatId,
        seatNumber: seatCheck[0].seat_number,
        boardingStopId,
        status: 'CONFIRMED',
      },
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('[BOOKING_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to process seat reservation.' });
  } finally {
    connection.release();
  }
}

/**
 * POST /api/bookings/:id/cancel
 * Cancel a booking and release the seat reservation.
 */
export async function cancelBooking(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const userRole = req.user!.role;
  const bookingId = parseInt(req.params.id, 10);
  const { reason = 'Cancelled by passenger' } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [bookings]: any = await connection.query(
      `SELECT booking_id, user_id, trip_id, seat_id, booking_status
       FROM bookings
       WHERE booking_id = ? FOR UPDATE`,
      [bookingId]
    );

    if (bookings.length === 0) {
      await connection.rollback();
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    const booking = bookings[0];

    // Authorization: User can cancel their own booking, or MANAGER can cancel any booking
    if (userRole !== 'MANAGER' && booking.user_id !== userId) {
      await connection.rollback();
      res.status(403).json({ error: 'You are not authorized to cancel this booking.' });
      return;
    }

    if (booking.booking_status === 'CANCELLED') {
      await connection.rollback();
      res.status(400).json({ error: 'Booking has already been cancelled.' });
      return;
    }

    // 1. Update booking status
    await connection.query(
      `UPDATE bookings
       SET booking_status = 'CANCELLED',
           cancelled_at = CURRENT_TIMESTAMP,
           cancellation_reason = ?
       WHERE booking_id = ?`,
      [reason, bookingId]
    );

    // 2. Delete seat reservation (releasing seat)
    await connection.query(
      `DELETE FROM trip_seat_reservations WHERE booking_id = ?`,
      [bookingId]
    );

    // 3. Update check-in record
    await connection.query(
      `UPDATE check_ins
       SET boarding_status = 'CANCELLED_PRIOR'
       WHERE booking_id = ?`,
      [bookingId]
    );

    await connection.commit();

    res.json({
      message: 'Booking cancelled successfully and seat released.',
      bookingId,
      status: 'CANCELLED',
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('[BOOKING_CANCEL_ERROR]', error);
    res.status(500).json({ error: 'Failed to cancel booking.' });
  } finally {
    connection.release();
  }
}

/**
 * GET /api/bookings/my
 * Retrieve all bookings for the authenticated user.
 */
export async function getMyBookings(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const [rows]: any = await pool.query(
      `SELECT b.booking_id, b.user_id, b.trip_id, b.booking_status, b.booking_time,
              b.cancelled_at, b.cancellation_reason,
              t.trip_date, t.departure_time, t.estimated_arrival_time, t.direction, t.trip_category, t.trip_status,
              r.route_name, r.origin, r.destination,
              c.corridor_name,
              bus.bus_no,
              s.seat_number,
              st.stop_name AS boarding_stop_name,
              ci.boarding_status AS check_in_status,
              ci.boarded_at
       FROM bookings b
       JOIN trips t ON b.trip_id = t.trip_id
       JOIN routes r ON b.route_id = r.route_id
       JOIN route_corridors c ON r.corridor_id = c.corridor_id
       JOIN buses bus ON t.bus_id = bus.bus_id
       JOIN seats s ON b.seat_id = s.seat_id
       JOIN stops st ON b.boarding_stop_id = st.stop_id
       LEFT JOIN check_ins ci ON b.booking_id = ci.booking_id
       WHERE b.user_id = ?
       ORDER BY t.trip_date DESC, t.departure_time DESC`,
      [userId]
    );

    res.json({ bookings: rows });
  } catch (error: any) {
    console.error('[MY_BOOKINGS_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve your bookings.' });
  }
}

/**
 * GET /api/bookings/:id
 * Retrieve single booking details with boarding pass QR payload.
 */
export async function getBookingById(req: Request, res: Response): Promise<void> {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const [rows]: any = await pool.query(
      `SELECT b.booking_id, b.user_id, b.trip_id, b.booking_status, b.booking_time,
              b.cancelled_at, b.cancellation_reason,
              u.full_name AS passenger_name, u.email AS passenger_email, u.phone_number AS passenger_phone,
              t.trip_date, t.departure_time, t.estimated_arrival_time, t.direction, t.trip_category, t.trip_status,
              r.route_name, r.origin, r.destination,
              c.corridor_name,
              bus.bus_no,
              s.seat_number,
              st.stop_name AS boarding_stop_name,
              ci.boarding_status AS check_in_status,
              ci.boarded_at
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       JOIN trips t ON b.trip_id = t.trip_id
       JOIN routes r ON b.route_id = r.route_id
       JOIN route_corridors c ON r.corridor_id = c.corridor_id
       JOIN buses bus ON t.bus_id = bus.bus_id
       JOIN seats s ON b.seat_id = s.seat_id
       JOIN stops st ON b.boarding_stop_id = st.stop_id
       LEFT JOIN check_ins ci ON b.booking_id = ci.booking_id
       WHERE b.booking_id = ?`,
      [bookingId]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    const booking = rows[0];

    if (userRole !== 'MANAGER' && booking.user_id !== userId) {
      res.status(403).json({ error: 'You are not authorized to view this booking.' });
      return;
    }

    // Boarding pass verification QR code payload
    const isTripCancelled = booking.trip_status === 'CANCELLED';
    const isBookingCancelled = booking.booking_status === 'CANCELLED';
    const isValidPass = !isTripCancelled && !isBookingCancelled;

    const qrPayload = isValidPass
      ? JSON.stringify({
          bookingId: booking.booking_id,
          userId: booking.user_id,
          tripId: booking.trip_id,
          seat: booking.seat_number,
          passenger: booking.passenger_name,
          tripDate: booking.trip_date,
          departure: booking.departure_time,
          signature: `JKLU-PASS-${booking.booking_id}-${booking.trip_id}`,
        })
      : null;

    res.json({
      booking,
      boardingPass: {
        qrPayload,
        verified: isValidPass,
        tripStatus: booking.trip_status,
      },
    });
  } catch (error: any) {
    console.error('[BOOKING_GET_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve booking.' });
  }
}

