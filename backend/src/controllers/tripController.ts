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
      query += ` AND t.trip_status NOT IN ('CANCELLED', 'DELETED')
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
  const {
    routeId, direction, busId, driverId, tripDate, departureTime,
    estimatedArrivalTime, tripCategory = 'STANDARD', tripStatus = 'SCHEDULED',
  } = req.body;

  if (!routeId || !direction || !busId || !tripDate || !departureTime) {
    res.status(400).json({
      error: 'routeId, direction, busId, tripDate, and departureTime are required.',
    });
    return;
  }
  if (!['OUTBOUND', 'RETURN'].includes(direction) ||
      !['STANDARD', 'EXTRA'].includes(tripCategory) ||
      !['SCHEDULED', 'PUBLISHED'].includes(tripStatus)) {
    res.status(400).json({ error: 'Invalid direction, trip category, or initial trip status.' });
    return;
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;

    // Read the corridor ID, then lock all referenced resources in a consistent order.
    const [routeInfo]: any = await connection.query(
      'SELECT corridor_id FROM routes WHERE route_id = ?',
      [routeId]
    );
    if (!routeInfo.length) {
      await connection.rollback(); transactionStarted = false;
      res.status(400).json({ error: `Route ${routeId} does not exist.` });
      return;
    }
    const corridorId = routeInfo[0].corridor_id;

    const [corridors]: any = await connection.query(
      "SELECT corridor_id, status FROM route_corridors WHERE corridor_id = ? FOR UPDATE",
      [corridorId]
    );
    if (!corridors.length || corridors[0].status !== 'ACTIVE') {
      await connection.rollback(); transactionStarted = false;
      res.status(409).json({ error: 'Cannot schedule a trip on an inactive or unavailable corridor.' });
      return;
    }

    const [routes]: any = await connection.query(
      "SELECT route_id, corridor_id, direction, status FROM routes WHERE route_id = ? FOR UPDATE",
      [routeId]
    );
    if (!routes.length || Number(routes[0].corridor_id) !== Number(corridorId) ||
        routes[0].direction !== direction || routes[0].status !== 'ACTIVE') {
      await connection.rollback(); transactionStarted = false;
      res.status(409).json({ error: 'Cannot schedule a trip: the route is missing, inactive, or does not match the selected direction.' });
      return;
    }

    const [buses]: any = await connection.query(
      'SELECT bus_id, status FROM buses WHERE bus_id = ? FOR UPDATE',
      [busId]
    );
    if (!buses.length || buses[0].status !== 'ACTIVE') {
      await connection.rollback(); transactionStarted = false;
      res.status(409).json({ error: 'Cannot schedule a trip with an inactive or unavailable bus.' });
      return;
    }

    if (driverId) {
      const [drivers]: any = await connection.query(
        'SELECT driver_id, status FROM drivers WHERE driver_id = ? FOR UPDATE',
        [driverId]
      );
      if (!drivers.length || drivers[0].status !== 'ACTIVE') {
        await connection.rollback(); transactionStarted = false;
        res.status(409).json({ error: 'Cannot schedule a trip with an inactive or unavailable driver.' });
        return;
      }
    }

    const [routeStops]: any = await connection.query(
      'SELECT stop_id FROM route_stops WHERE route_id = ? ORDER BY stop_id ASC FOR UPDATE',
      [routeId]
    );
    const stopIds = routeStops.map((row: any) => Number(row.stop_id)).sort((a: number, b: number) => a - b);
    for (const stopId of stopIds) {
      const [stops]: any = await connection.query(
        'SELECT stop_id, status FROM stops WHERE stop_id = ? FOR UPDATE',
        [stopId]
      );
      if (!stops.length || stops[0].status !== 'ACTIVE') {
        await connection.rollback(); transactionStarted = false;
        res.status(409).json({
          error: 'Cannot schedule a trip because this route contains an inactive or unavailable stop.',
          dependencies: { stops: [{ stop_id: stopId }] },
        });
        return;
      }
    }

    const [result]: any = await connection.query(
      `INSERT INTO trips (route_id, direction, bus_id, driver_id, trip_date, departure_time, estimated_arrival_time, trip_category, trip_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [routeId, direction, busId, driverId || null, tripDate, departureTime,
       estimatedArrivalTime || null, tripCategory, tripStatus]
    );

    await connection.commit();
    transactionStarted = false;
    res.status(201).json({ message: 'Trip scheduled successfully.', tripId: result.insertId });
  } catch (error: any) {
    if (transactionStarted) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
    }
    console.error('[TRIP_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to schedule trip.' });
  } finally {
    connection.release();
  }
}

/**
 * PUT /api/trips/:id
 * MANAGER only: Update trip details and status.
 */
export async function updateTrip(req: Request, res: Response): Promise<void> {
  const tripId = Number.parseInt(req.params.id, 10);
  const { driverId, busId, departureTime, estimatedArrivalTime, tripStatus, tripCategory } = req.body;
  if (!Number.isInteger(tripId) || tripId <= 0) {
    res.status(400).json({ error: 'Invalid trip ID.' });
    return;
  }
  if (tripStatus !== undefined && !['SCHEDULED', 'PUBLISHED', 'COMPLETED'].includes(tripStatus)) {
    res.status(400).json({ error: 'Invalid trip status. Use the dedicated cancel action for CANCELLED; trips cannot be set to DELETED through update.' });
    return;
  }
  if (tripCategory !== undefined && !['STANDARD', 'EXTRA'].includes(tripCategory)) {
    res.status(400).json({ error: 'Invalid trip category.' });
    return;
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [existingRows]: any = await connection.query(
      'SELECT trip_id, route_id, bus_id, driver_id, trip_status FROM trips WHERE trip_id = ? FOR UPDATE',
      [tripId]
    );
    if (!existingRows.length) {
      await connection.rollback(); transactionStarted = false;
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }

    const existing = existingRows[0];
    const nextBusId = busId ?? existing.bus_id;
    const nextDriverId = driverId === undefined ? existing.driver_id : (driverId || null);
    const nextStatus = tripStatus ?? existing.trip_status;

    // Any trip being scheduled/published must continue to reference active resources.
    if (['SCHEDULED', 'PUBLISHED'].includes(nextStatus)) {
      const [routeInfo]: any = await connection.query(
        'SELECT corridor_id FROM routes WHERE route_id = ?',
        [existing.route_id]
      );
      if (!routeInfo.length) {
        await connection.rollback(); transactionStarted = false;
        res.status(409).json({ error: 'Cannot activate this trip because its route no longer exists.' });
        return;
      }
      const corridorId = routeInfo[0].corridor_id;
      const [corridors]: any = await connection.query(
        'SELECT status FROM route_corridors WHERE corridor_id = ? FOR UPDATE',
        [corridorId]
      );
      const [routes]: any = await connection.query(
        'SELECT status FROM routes WHERE route_id = ? FOR UPDATE',
        [existing.route_id]
      );
      const [buses]: any = await connection.query(
        'SELECT status FROM buses WHERE bus_id = ? FOR UPDATE',
        [nextBusId]
      );
      if (!corridors.length || corridors[0].status !== 'ACTIVE' ||
          !routes.length || routes[0].status !== 'ACTIVE') {
        await connection.rollback(); transactionStarted = false;
        res.status(409).json({ error: 'Cannot schedule or publish this trip while its route or corridor is inactive.' });
        return;
      }
      if (!buses.length || buses[0].status !== 'ACTIVE') {
        await connection.rollback(); transactionStarted = false;
        res.status(409).json({ error: 'Cannot schedule or publish this trip with an inactive or unavailable bus.' });
        return;
      }
      if (nextDriverId) {
        const [drivers]: any = await connection.query(
          'SELECT status FROM drivers WHERE driver_id = ? FOR UPDATE',
          [nextDriverId]
        );
        if (!drivers.length || drivers[0].status !== 'ACTIVE') {
          await connection.rollback(); transactionStarted = false;
          res.status(409).json({ error: 'Cannot schedule or publish this trip with an inactive or unavailable driver.' });
          return;
        }
      }
      const [routeStops]: any = await connection.query(
        'SELECT stop_id FROM route_stops WHERE route_id = ? ORDER BY stop_id ASC FOR UPDATE',
        [existing.route_id]
      );
      const stopIds = routeStops.map((row: any) => Number(row.stop_id)).sort((a: number, b: number) => a - b);
      for (const stopId of stopIds) {
        const [stops]: any = await connection.query(
          'SELECT status FROM stops WHERE stop_id = ? FOR UPDATE',
          [stopId]
        );
        if (!stops.length || stops[0].status !== 'ACTIVE') {
          await connection.rollback(); transactionStarted = false;
          res.status(409).json({ error: 'Cannot schedule or publish this trip because its route contains an inactive or unavailable stop.', dependencies: { stops: [{ stop_id: stopId }] } });
          return;
        }
      }
    }

    await connection.query(
      `UPDATE trips
       SET driver_id = ?, bus_id = ?,
           departure_time = COALESCE(?, departure_time),
           estimated_arrival_time = COALESCE(?, estimated_arrival_time),
           trip_status = ?, trip_category = COALESCE(?, trip_category)
       WHERE trip_id = ?`,
      [nextDriverId, nextBusId, departureTime ?? null, estimatedArrivalTime ?? null,
       nextStatus, tripCategory ?? null, tripId]
    );
    await connection.commit();
    transactionStarted = false;
    res.json({ message: 'Trip updated successfully.', tripId });
  } catch (error: any) {
    if (transactionStarted) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
    }
    console.error('[TRIP_UPDATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to update trip.' });
  } finally {
    connection.release();
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
        AND t.trip_status NOT IN ('CANCELLED', 'DELETED')
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
 * Shared trip lifecycle operation. Passenger booking and check-in rows are retained.
 */
async function transitionTrip(req: Request, res: Response, action: 'CANCELLED' | 'DELETED'): Promise<void> {
  const tripId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    res.status(400).json({ error: 'Invalid trip ID.' });
    return;
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [trips]: any = await connection.query(
      'SELECT trip_id, trip_status FROM trips WHERE trip_id = ? FOR UPDATE', [tripId]
    );
    if (!trips.length) {
      await connection.rollback(); transactionStarted = false;
      res.status(404).json({ error: 'Trip not found.' }); return;
    }

    const currentStatus = trips[0].trip_status;
    if (currentStatus === 'DELETED') {
      await connection.rollback(); transactionStarted = false;
      res.status(409).json({ error: 'Trip #' + tripId + ' has already been deleted.' }); return;
    }
    if (currentStatus === 'COMPLETED') {
      await connection.rollback(); transactionStarted = false;
      res.status(409).json({ error: 'Completed trips are retained as historical records and cannot be deleted or cancelled.' }); return;
    }
    if (action === 'CANCELLED' && currentStatus === 'CANCELLED') {
      await connection.commit(); transactionStarted = false;
      res.json({ message: 'Trip #' + tripId + ' is already cancelled. Passenger history remains preserved.', action, tripId, cancelledBookings: 0, historyPreserved: true }); return;
    }

    const [bookingRows]: any = await connection.query(
      "SELECT COUNT(*) AS count FROM bookings WHERE trip_id = ? AND booking_status = 'CONFIRMED'", [tripId]
    );
    const cancelledBookings = Number(bookingRows[0]?.count || 0);

    await connection.query(
      "UPDATE check_ins ci INNER JOIN bookings b ON b.booking_id = ci.booking_id SET ci.boarding_status = 'CANCELLED_PRIOR' WHERE b.trip_id = ? AND b.booking_status = 'CONFIRMED' AND ci.boarding_status NOT IN ('BOARDED', 'NO_SHOW')",
      [tripId]
    );

    const reason = action === 'DELETED' ? 'Trip deleted by manager' : 'Trip cancelled by manager';
    await connection.query(
      "UPDATE bookings SET booking_status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP), cancellation_reason = ? WHERE trip_id = ? AND booking_status = 'CONFIRMED'",
      [reason, tripId]
    );
    await connection.query('DELETE FROM trip_seat_reservations WHERE trip_id = ?', [tripId]);
    await connection.query('UPDATE trips SET trip_status = ? WHERE trip_id = ?', [action, tripId]);

    await connection.commit();
    transactionStarted = false;
    const verb = action === 'DELETED' ? 'deleted' : 'cancelled';
    res.json({
      message: 'Trip #' + tripId + ' has been ' + verb + '. ' + cancelledBookings + ' confirmed booking(s) were marked cancelled, seat reservations were released, and passenger booking/check-in history was preserved.',
      action, tripId, cancelledBookings, historyPreserved: true, tripRecordRetained: true,
    });
  } catch (error: any) {
    if (transactionStarted) { try { await connection.rollback(); } catch { /* preserve original error */ } }
    console.error('[TRIP_' + action + '_ERROR]', error);
    res.status(500).json({ error: 'Failed to ' + action.toLowerCase() + ' trip #' + tripId + ': ' + (error.sqlMessage || error.message || 'Database error') });
  } finally {
    connection.release();
  }
}

/** POST /api/trips/:id/cancel — cancel while retaining cancelled trip history. */
export async function cancelTrip(req: Request, res: Response): Promise<void> {
  await transitionTrip(req, res, 'CANCELLED');
}

/** DELETE /api/trips/:id — soft-delete from operations, retaining the trip and passenger history. */
export async function deleteTrip(req: Request, res: Response): Promise<void> {
  await transitionTrip(req, res, 'DELETED');
}
