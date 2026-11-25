import { Request, Response } from 'express';
import { pool } from '../config/db.js';

/**
 * GET /api/trips
 * List trips with filtering by date, direction, corridor, category, and status.
 */
export async function listTrips(req: Request, res: Response): Promise<void> {
  try {
    const { date, direction, corridorId, category, status } = req.query;

    let query = `
      SELECT t.trip_id, t.route_id, t.direction, t.bus_id, t.driver_id,
             t.trip_date, t.departure_time, t.estimated_arrival_time,
             t.trip_category, t.trip_status, t.created_at,
             r.route_name, r.origin, r.destination,
             c.corridor_id, c.corridor_name,
             b.bus_no, b.total_no_of_seats,
             d.driver_name, d.phone_number AS driver_phone,
             (SELECT COUNT(*) FROM trip_seat_reservations tsr WHERE tsr.trip_id = t.trip_id) AS booked_seats_count
      FROM trips t
      JOIN routes r ON t.route_id = r.route_id
      JOIN route_corridors c ON r.corridor_id = c.corridor_id
      JOIN buses b ON t.bus_id = b.bus_id
      LEFT JOIN drivers d ON t.driver_id = d.driver_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Students should only see trips that are available to book. Managers retain
    // visibility of cancelled trips for operational history and review.
    if (req.user?.role !== 'MANAGER') {
      query += ` AND t.trip_status <> 'CANCELLED'
                  AND r.status = 'ACTIVE'
                  AND c.status = 'ACTIVE'
                  AND b.status = 'ACTIVE'`;
    }

    if (date) {
      query += ` AND t.trip_date = ?`;
      params.push(date);
    }
    if (direction && ['OUTBOUND', 'RETURN'].includes(direction as string)) {
      query += ` AND t.direction = ?`;
      params.push(direction);
    }
    if (corridorId) {
      query += ` AND c.corridor_id = ?`;
      params.push(parseInt(corridorId as string, 10));
    }
    if (category && ['STANDARD', 'EXTRA'].includes(category as string)) {
      query += ` AND t.trip_category = ?`;
      params.push(category);
    }
    if (status) {
      query += ` AND t.trip_status = ?`;
      params.push(status);
    }

    query += ` ORDER BY t.trip_date ASC, t.departure_time ASC`;

    const [rows]: any = await pool.query(query, params);

    const trips = rows.map((r: any) => ({
      ...r,
      available_seats_count: Math.max(0, r.total_no_of_seats - r.booked_seats_count),
    }));

    res.json({ trips });
  } catch (error: any) {
    console.error('[TRIPS_LIST_ERROR]', error);
    res.status(500).json({ error: 'Failed to list trips.' });
  }
}

/**
 * GET /api/trips/:id
 * Get trip details with interactive seat map and availability.
 */
export async function getTripById(req: Request, res: Response): Promise<void> {
  try {
    const tripId = parseInt(req.params.id, 10);
    const userId = req.user?.userId;

    const [tripRows]: any = await pool.query(
      `SELECT t.trip_id, t.route_id, t.direction, t.bus_id, t.driver_id,
              t.trip_date, t.departure_time, t.estimated_arrival_time,
              t.trip_category, t.trip_status,
              r.route_name, r.origin, r.destination,
              c.corridor_id, c.corridor_name,
              b.bus_no, b.total_no_of_seats,
              d.driver_name, d.phone_number AS driver_phone
       FROM trips t
       JOIN routes r ON t.route_id = r.route_id
       JOIN route_corridors c ON r.corridor_id = c.corridor_id
       JOIN buses b ON t.bus_id = b.bus_id
       LEFT JOIN drivers d ON t.driver_id = d.driver_id
       WHERE t.trip_id = ?`,
      [tripId]
    );

    if (tripRows.length === 0) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }

    const trip = tripRows[0];

    // Fetch ordered route stops for boarding selection
    const [stops]: any = await pool.query(
      `SELECT rs.route_stop_id, rs.stop_id, rs.stop_order, rs.estimated_offset_minutes,
              s.stop_name
       FROM route_stops rs
       JOIN stops s ON rs.stop_id = s.stop_id
       WHERE rs.route_id = ?
       ORDER BY rs.stop_order ASC`,
      [trip.route_id]
    );

    // Fetch all physical seats on this bus
    const [allSeats]: any = await pool.query(
      `SELECT seat_id, bus_id, seat_number
       FROM seats
       WHERE bus_id = ?
       ORDER BY CAST(seat_number AS UNSIGNED) ASC, seat_number ASC`,
      [trip.bus_id]
    );

    // Fetch active reservations for this trip
    const [reservations]: any = await pool.query(
      `SELECT reservation_id, booking_id, trip_id, user_id, seat_id, bus_id, reserved_at
       FROM trip_seat_reservations
       WHERE trip_id = ?`,
      [tripId]
    );

    const reservationMap = new Map<number, any>();
    for (const resItem of reservations) {
      reservationMap.set(resItem.seat_id, resItem);
    }

    // Assemble seat map with real-time status
    const seatMap = allSeats.map((seat: any) => {
      const resItem = reservationMap.get(seat.seat_id);
      let status = 'AVAILABLE';
      let isMySeat = false;

      if (resItem) {
        if (userId && resItem.user_id === userId) {
          status = 'RESERVED_BY_YOU';
          isMySeat = true;
        } else {
          status = 'OCCUPIED';
        }
      }

      return {
        seatId: seat.seat_id,
        seatNumber: seat.seat_number,
        status,
        isMySeat,
      };
    });

    const bookedCount = reservations.length;
    const availableCount = Math.max(0, trip.total_no_of_seats - bookedCount);

    res.json({
      trip,
      routeStops: stops,
      seats: seatMap,
      inventory: {
        totalSeats: trip.total_no_of_seats,
        bookedSeats: bookedCount,
        availableSeats: availableCount,
      },
    });
  } catch (error: any) {
    console.error('[TRIP_GET_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve trip.' });
  }
}

/**
 * POST /api/trips
 * MANAGER only: Schedule a new trip.
 */
export async function createTrip(req: Request, res: Response): Promise<void> {
  try {
    const {
      routeId,
      direction,
      busId,
      driverId,
      tripDate,
      departureTime,
      estimatedArrivalTime,
      tripCategory = 'STANDARD',
      tripStatus = 'SCHEDULED',
    } = req.body;

    if (!routeId || !direction || !busId || !tripDate || !departureTime) {
      res.status(400).json({
        error: 'routeId, direction, busId, tripDate, and departureTime are required.',
      });
      return;
    }

    // Verify route and direction match
    const [routeCheck]: any = await pool.query(
      `SELECT route_id, direction FROM routes WHERE route_id = ? AND direction = ?`,
      [routeId, direction]
    );
    if (routeCheck.length === 0) {
      res.status(400).json({
        error: `Route ${routeId} does not match direction ${direction}.`,
      });
      return;
    }

    const [result]: any = await pool.query(
      `INSERT INTO trips (route_id, direction, bus_id, driver_id, trip_date, departure_time, estimated_arrival_time, trip_category, trip_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        routeId,
        direction,
        busId,
        driverId || null,
        tripDate,
        departureTime,
        estimatedArrivalTime || null,
        tripCategory,
        tripStatus,
      ]
    );

    res.status(201).json({
      message: 'Trip scheduled successfully.',
      tripId: result.insertId,
    });
  } catch (error: any) {
    console.error('[TRIP_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to schedule trip.' });
  }
}

/**
 * PUT /api/trips/:id
 * MANAGER only: Update trip details and status.
 */
export async function updateTrip(req: Request, res: Response): Promise<void> {
  try {
    const tripId = parseInt(req.params.id, 10);
    const { driverId, busId, departureTime, estimatedArrivalTime, tripStatus, tripCategory } = req.body;

    const [result]: any = await pool.query(
      `UPDATE trips
       SET driver_id = COALESCE(?, driver_id),
           bus_id = COALESCE(?, bus_id),
           departure_time = COALESCE(?, departure_time),
           estimated_arrival_time = COALESCE(?, estimated_arrival_time),
           trip_status = COALESCE(?, trip_status),
           trip_category = COALESCE(?, trip_category)
       WHERE trip_id = ?`,
      [
        driverId ?? null,
        busId ?? null,
        departureTime ?? null,
        estimatedArrivalTime ?? null,
        tripStatus ?? null,
        tripCategory ?? null,
        tripId,
      ]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }

    res.json({ message: 'Trip updated successfully.', tripId });
  } catch (error: any) {
    console.error('[TRIP_UPDATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to update trip.' });
  }
}

/**
 * GET /api/trips/audit/return-service-check
 * MANAGER only: Return Service Audit.
 * Inspects all dates with scheduled OUTBOUND trips.
 * Checks whether a corresponding RETURN trip is scheduled on that date and corridor without any arbitrary departure time restriction.
 * STRICT DIRECTIVE: Does NOT fabricate or auto-generate rows.
 */
export async function returnServiceAuditCheck(req: Request, res: Response): Promise<void> {
  try {
    // 1. Find all corridor + date combinations with scheduled OUTBOUND trips
    const [outboundTrips]: any = await pool.query(`
      SELECT DISTINCT t.trip_date, r.corridor_id, c.corridor_name, r.route_name
      FROM trips t
      JOIN routes r ON t.route_id = r.route_id
      JOIN route_corridors c ON r.corridor_id = c.corridor_id
      WHERE t.direction = 'OUTBOUND'
        AND t.trip_status != 'CANCELLED'
        AND t.trip_date >= CURRENT_DATE()
      ORDER BY t.trip_date ASC, c.corridor_name ASC
    `);

    // 2. Find all RETURN trips on those dates (scheduled at any valid operational time)
    const [returnTrips]: any = await pool.query(`
      SELECT DISTINCT t.trip_date, r.corridor_id, t.departure_time
      FROM trips t
      JOIN routes r ON t.route_id = r.route_id
      WHERE t.direction = 'RETURN'
        AND t.trip_status != 'CANCELLED'
        AND t.trip_date >= CURRENT_DATE()
    `);

    const returnSet = new Set<string>();
    for (const ret of returnTrips) {
      const dateStr = ret.trip_date instanceof Date ? ret.trip_date.toISOString().split('T')[0] : String(ret.trip_date);
      returnSet.add(`${dateStr}:${ret.corridor_id}`);
    }

    // 3. Compare and collect status
    const auditWarnings: any[] = [];
    const compliantCorridors: any[] = [];

    for (const out of outboundTrips) {
      const dateStr = out.trip_date instanceof Date ? out.trip_date.toISOString().split('T')[0] : String(out.trip_date);
      const key = `${dateStr}:${out.corridor_id}`;

      if (!returnSet.has(key)) {
        auditWarnings.push({
          date: dateStr,
          corridorId: out.corridor_id,
          corridorName: out.corridor_name,
          routeSample: out.route_name,
          severity: 'INFO',
          message: `Notice: Outbound service scheduled on ${dateStr} for corridor "${out.corridor_name}" has no return service registered yet.`,
        });
      } else {
        compliantCorridors.push({
          date: dateStr,
          corridorId: out.corridor_id,
          corridorName: out.corridor_name,
          status: 'COMPLIANT_RETURN_SCHEDULED',
        });
      }
    }

    res.json({
      auditStatus: auditWarnings.length === 0 ? 'ALL_RETURN_SERVICES_SCHEDULED' : 'RETURN_SERVICES_UNSCHEDULED',
      totalOutboundDaysChecked: outboundTrips.length,
      warningCount: auditWarnings.length,
      warnings: auditWarnings,
      compliantCount: compliantCorridors.length,
      note: 'Return service check report: Flexible scheduling without fixed time constraints.',
    });
  } catch (error: any) {
    console.error('[RETURN_SERVICE_AUDIT_ERROR]', error);
    res.status(500).json({ error: 'Failed to perform return service audit check.' });
  }
}

/**
 * DELETE /api/trips/:id
 * MANAGER only: Cancel or delete a scheduled trip.
 */
export async function deleteTrip(req: Request, res: Response): Promise<void> {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: 'Invalid trip ID.' });
    return;
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;

    // Lock the trip so a booking cannot be created while cancellation is in progress.
    const [trips]: any = await connection.query(
      'SELECT trip_id, trip_status FROM trips WHERE trip_id = ? FOR UPDATE',
      [tripId]
    );
    if (trips.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }

    // Preserve historical bookings and check-ins. Only confirmed bookings are cancelled.
    const [bookingRows]: any = await connection.query(
      "SELECT COUNT(*) AS count FROM bookings WHERE trip_id = ? AND booking_status = 'CONFIRMED'",
      [tripId]
    );
    const cancelledBookings = Number(bookingRows[0]?.count || 0);

    // Preserve completed boarding/no-show history; mark remaining check-ins as cancelled prior.
    await connection.query(
      "UPDATE check_ins ci INNER JOIN bookings b ON b.booking_id = ci.booking_id SET ci.boarding_status = 'CANCELLED_PRIOR' WHERE b.trip_id = ? AND b.booking_status = 'CONFIRMED' AND ci.boarding_status NOT IN ('BOARDED', 'NO_SHOW')",
      [tripId]
    );

    await connection.query(
      "UPDATE bookings SET booking_status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = 'Trip cancelled by manager' WHERE trip_id = ? AND booking_status = 'CONFIRMED'",
      [tripId]
    );

    // Release active seat locks but retain booking and check-in audit records.
    await connection.query('DELETE FROM trip_seat_reservations WHERE trip_id = ?', [tripId]);
    await connection.query("UPDATE trips SET trip_status = 'CANCELLED' WHERE trip_id = ?", [tripId]);

    await connection.commit();
    transactionStarted = false;

    res.json({
      message: 'Trip #' + tripId + ' has been cancelled. ' + cancelledBookings + ' confirmed booking(s) were cancelled, seat reservations were released, and passenger history was preserved.',
      action: 'CANCELLED',
      tripId,
      cancelledBookings,
      historyPreserved: true,
    });
  } catch (error: any) {
    if (transactionStarted) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
    }
    console.error('[TRIP_CANCEL_ERROR]', error);
    res.status(500).json({
      error: 'Failed to cancel trip #' + tripId + ': ' + (error.sqlMessage || error.message || 'Database error'),
    });
  } finally {
    connection.release();
  }
}
