import { Request, Response } from 'express';
import { pool } from '../config/db.js';

// ======================== BUSES ========================

/**
 * GET /api/fleet/buses
 * List all buses with seat count and status.
 */
export async function listBuses(req: Request, res: Response): Promise<void> {
  try {
    const [rows]: any = await pool.query(
      `SELECT b.bus_id, b.bus_no, b.total_no_of_seats, b.status, b.created_at,
              COUNT(s.seat_id) AS generated_seat_count
       FROM buses b
       LEFT JOIN seats s ON b.bus_id = s.bus_id
       GROUP BY b.bus_id, b.bus_no, b.total_no_of_seats, b.status, b.created_at
       ORDER BY b.bus_no ASC`
    );
    res.json({ buses: rows });
  } catch (error: any) {
    console.error('[FLEET_BUS_LIST_ERROR]', error);
    res.status(500).json({ error: 'Failed to list buses.' });
  }
}

/**
 * GET /api/fleet/buses/:id
 * Get bus details including individual seat inventory.
 */
export async function getBusById(req: Request, res: Response): Promise<void> {
  try {
    const busId = parseInt(req.params.id, 10);
    const [busRows]: any = await pool.query(
      `SELECT bus_id, bus_no, total_no_of_seats, status, created_at FROM buses WHERE bus_id = ?`,
      [busId]
    );

    if (busRows.length === 0) {
      res.status(404).json({ error: 'Bus not found.' });
      return;
    }

    const [seatRows]: any = await pool.query(
      `SELECT seat_id, bus_id, seat_number FROM seats WHERE bus_id = ? ORDER BY CAST(seat_number AS UNSIGNED) ASC, seat_number ASC`,
      [busId]
    );

    res.json({ bus: busRows[0], seats: seatRows });
  } catch (error: any) {
    console.error('[FLEET_BUS_GET_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve bus.' });
  }
}

/**
 * POST /api/fleet/buses
 * MANAGER only: Create a bus and auto-generate physical seat rows.
 */
export async function createBus(req: Request, res: Response): Promise<void> {
  const { busNo, totalSeats, status = 'ACTIVE' } = req.body;

  if (!busNo || !totalSeats || totalSeats <= 0) {
    res.status(400).json({ error: 'Valid busNo and positive totalSeats are required.' });
    return;
  }

  const trimmedBusNo = String(busNo).trim();

  // 1. Check for existing bus number before inserting
  const [existingBuses]: any = await pool.query(
    'SELECT bus_id, bus_no, total_no_of_seats, status FROM buses WHERE bus_no = ?',
    [trimmedBusNo]
  );

  if (existingBuses.length > 0) {
    const existing = existingBuses[0];
    if (existing.status === 'RETIRED') {
      res.status(409).json({
        error: `Bus "${trimmedBusNo}" already exists as RETIRED. You can reactivate this bus instead of registering a duplicate.`,
        canReactivate: true,
        bus: {
          bus_id: existing.bus_id,
          bus_no: existing.bus_no,
          total_no_of_seats: existing.total_no_of_seats,
          status: existing.status,
        },
      });
      return;
    }
    res.status(409).json({
      error: `A bus with number "${trimmedBusNo}" already exists (status: ${existing.status}).`,
      canReactivate: false,
    });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [insertResult]: any = await connection.query(
      `INSERT INTO buses (bus_no, total_no_of_seats, status) VALUES (?, ?, ?)`,
      [trimmedBusNo, totalSeats, status]
    );

    const busId = insertResult.insertId;

    // Automatically generate physical seat inventory
    const seatValues: any[] = [];
    for (let i = 1; i <= totalSeats; i++) {
      seatValues.push([busId, String(i)]);
    }

    await connection.query(
      `INSERT INTO seats (bus_id, seat_number) VALUES ?`,
      [seatValues]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Bus and physical seat inventory successfully registered.',
      bus: { bus_id: busId, bus_no: trimmedBusNo, total_no_of_seats: totalSeats, status },
      seatCount: totalSeats,
    });
  } catch (error: any) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: `A bus with number "${trimmedBusNo}" already exists.` });
      return;
    }
    console.error('[FLEET_BUS_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to create bus.' });
  } finally {
    connection.release();
  }
}

/**
 * PUT /api/fleet/buses/:id
 * MANAGER only: Update bus status.
 */
export async function updateBus(req: Request, res: Response): Promise<void> {
  try {
    const busId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!['ACTIVE', 'MAINTENANCE', 'RETIRED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be ACTIVE, MAINTENANCE, or RETIRED.' });
      return;
    }

    const [result]: any = await pool.query(
      `UPDATE buses SET status = ? WHERE bus_id = ?`,
      [status, busId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Bus not found.' });
      return;
    }

    res.json({ message: 'Bus updated successfully.', busId, status });
  } catch (error: any) {
    console.error('[FLEET_BUS_UPDATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to update bus.' });
  }
}

/**
 * DELETE /api/fleet/buses/:id
 * MANAGER only: Retire/deactivate or delete bus.
 */
export async function deleteBus(req: Request, res: Response): Promise<void> {
  try {
    const busId = parseInt(req.params.id, 10);
    if (isNaN(busId)) {
      res.status(400).json({ error: 'Invalid bus ID.' });
      return;
    }

    const [buses]: any = await pool.query(
      'SELECT bus_id, bus_no, status FROM buses WHERE bus_id = ?',
      [busId]
    );

    if (buses.length === 0) {
      res.status(404).json({ error: 'Bus not found.' });
      return;
    }

    const bus = buses[0];

    // 1. Check for active or upcoming scheduled trips
    const [activeTrips]: any = await pool.query(
      `SELECT COUNT(*) AS count FROM trips 
       WHERE bus_id = ? 
         AND trip_status IN ('SCHEDULED', 'PUBLISHED') 
         AND trip_date >= CURRENT_DATE()`,
      [busId]
    );

    if (activeTrips[0].count > 0) {
      res.status(400).json({
        error: `Cannot delete bus "${bus.bus_no}": It is assigned to ${activeTrips[0].count} active or upcoming trip(s). Please reassign or cancel those trips first.`,
      });
      return;
    }

    // 2. Check both historical trips AND historical bookings referencing seats of this bus
    const [historicalTrips]: any = await pool.query(
      'SELECT COUNT(*) AS count FROM trips WHERE bus_id = ?',
      [busId]
    );

    const [historicalBookings]: any = await pool.query(
      `SELECT COUNT(*) AS count 
       FROM bookings b 
       JOIN seats s ON b.seat_id = s.seat_id 
       WHERE s.bus_id = ?`,
      [busId]
    );

    const tripCount = historicalTrips[0]?.count || 0;
    const bookingCount = historicalBookings[0]?.count || 0;
    const hasHistoricalRecords = tripCount > 0 || bookingCount > 0;

    if (hasHistoricalRecords) {
      // Soft deletion: retire the bus to preserve trip & booking history
      await pool.query(
        "UPDATE buses SET status = 'RETIRED' WHERE bus_id = ?",
        [busId]
      );
      res.json({
        message: `Bus "${bus.bus_no}" has historical records (${tripCount} trip(s), ${bookingCount} booking(s)). It has been deactivated and marked as RETIRED to preserve audit history.`,
        action: 'RETIRED',
        busId,
      });
      return;
    }

    // 3. If zero historical records exist: attempt clean hard deletion of seats and bus in a transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM seats WHERE bus_id = ?', [busId]);
      await connection.query('DELETE FROM buses WHERE bus_id = ?', [busId]);
      await connection.commit();
      res.json({
        message: `Bus "${bus.bus_no}" and its seat inventory have been permanently deleted.`,
        action: 'DELETED',
        busId,
      });
    } catch (delError: any) {
      await connection.rollback();

      // Check for genuine foreign-key constraint error (e.g. ER_ROW_IS_REFERENCED_2, errno 1451, errno 1217)
      const isForeignKeyConstraint =
        delError.code === 'ER_ROW_IS_REFERENCED_2' ||
        delError.code === 'ER_ROW_IS_REFERENCED' ||
        delError.errno === 1451 ||
        delError.errno === 1217;

      if (isForeignKeyConstraint) {
        // Genuine FK constraint prevented deletion; safely fall back to RETIRED
        console.warn(`[FLEET_BUS_DELETE_WARN] Bus ${busId} has relational dependencies (${delError.code}). Falling back to RETIRED.`);
        await pool.query(
          "UPDATE buses SET status = 'RETIRED' WHERE bus_id = ?",
          [busId]
        );
        res.json({
          message: `Bus "${bus.bus_no}" has relational dependencies and has been safely marked as RETIRED.`,
          action: 'RETIRED',
          busId,
        });
        return;
      }

      // For permission errors, connection drops, or unexpected failures, log and return error
      console.error('[FLEET_BUS_DELETE_ERROR] Deletion failed unexpectedly:', delError);
      res.status(500).json({
        error: `Failed to permanently delete bus "${bus.bus_no}": ${delError.sqlMessage || delError.message || 'Database error'}. The record was not retired.`,
      });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('[FLEET_BUS_DELETE_ERROR]', error);
    res.status(500).json({ error: 'Failed to process bus deletion.' });
  }
}

// ======================== DRIVERS ========================

/**
 * GET /api/fleet/drivers
 * List drivers.
 */
export async function listDrivers(req: Request, res: Response): Promise<void> {
  try {
    const [rows]: any = await pool.query(
      `SELECT driver_id, driver_name, licence_number, phone_number, status, created_at
       FROM drivers
       ORDER BY driver_name ASC`
    );
    res.json({ drivers: rows });
  } catch (error: any) {
    console.error('[FLEET_DRIVER_LIST_ERROR]', error);
    res.status(500).json({ error: 'Failed to list drivers.' });
  }
}

/**
 * POST /api/fleet/drivers
 * MANAGER only: Register a new driver.
 */
export async function createDriver(req: Request, res: Response): Promise<void> {
  try {
    const { driverName, licenceNumber, phoneNumber, status = 'ACTIVE' } = req.body;

    if (!driverName || !licenceNumber || !phoneNumber) {
      res.status(400).json({ error: 'Driver name, licence number, and phone number are required.' });
      return;
    }

    const [result]: any = await pool.query(
      `INSERT INTO drivers (driver_name, licence_number, phone_number, status) VALUES (?, ?, ?, ?)`,
      [driverName.trim(), licenceNumber.trim(), phoneNumber.trim(), status]
    );

    res.status(201).json({
      message: 'Driver successfully registered.',
      driver: {
        driver_id: result.insertId,
        driver_name: driverName.trim(),
        licence_number: licenceNumber.trim(),
        phone_number: phoneNumber.trim(),
        status,
      },
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: `A driver with licence number "${req.body.licenceNumber}" already exists.` });
      return;
    }
    console.error('[FLEET_DRIVER_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to create driver.' });
  }
}

/**
 * PUT /api/fleet/drivers/:id
 * MANAGER only: Update driver status and info.
 */
export async function updateDriver(req: Request, res: Response): Promise<void> {
  try {
    const driverId = parseInt(req.params.id, 10);
    const { driverName, licenceNumber, phoneNumber, status } = req.body;

    const [result]: any = await pool.query(
      `UPDATE drivers
       SET driver_name = COALESCE(?, driver_name),
           licence_number = COALESCE(?, licence_number),
           phone_number = COALESCE(?, phone_number),
           status = COALESCE(?, status)
       WHERE driver_id = ?`,
      [driverName?.trim() || null, licenceNumber?.trim() || null, phoneNumber?.trim() || null, status || null, driverId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Driver not found.' });
      return;
    }

    res.json({ message: 'Driver updated successfully.', driverId });
  } catch (error: any) {
    console.error('[FLEET_DRIVER_UPDATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to update driver.' });
  }
}

/**
 * DELETE /api/fleet/drivers/:id
 * MANAGER only: Deactivate or delete driver.
 */
export async function deleteDriver(req: Request, res: Response): Promise<void> {
  try {
    const driverId = parseInt(req.params.id, 10);
    if (isNaN(driverId)) {
      res.status(400).json({ error: 'Invalid driver ID.' });
      return;
    }

    const [drivers]: any = await pool.query(
      'SELECT driver_id, driver_name, status FROM drivers WHERE driver_id = ?',
      [driverId]
    );

    if (drivers.length === 0) {
      res.status(404).json({ error: 'Driver not found.' });
      return;
    }

    const driver = drivers[0];

    // 1. Check for active or upcoming scheduled trips
    const [activeTrips]: any = await pool.query(
      `SELECT COUNT(*) AS count FROM trips 
       WHERE driver_id = ? 
         AND trip_status IN ('SCHEDULED', 'PUBLISHED') 
         AND trip_date >= CURRENT_DATE()`,
      [driverId]
    );

    if (activeTrips[0].count > 0) {
      res.status(400).json({
        error: `Cannot delete driver "${driver.driver_name}": Driver is assigned to ${activeTrips[0].count} active or upcoming trip(s). Please reassign those trips first.`,
      });
      return;
    }

    // 2. Check for historical trips
    const [historicalTrips]: any = await pool.query(
      'SELECT COUNT(*) AS count FROM trips WHERE driver_id = ?',
      [driverId]
    );

    if (historicalTrips[0].count > 0) {
      // Soft deletion: mark driver INACTIVE to preserve historical trip logs
      await pool.query(
        "UPDATE drivers SET status = 'INACTIVE' WHERE driver_id = ?",
        [driverId]
      );
      res.json({
        message: `Driver "${driver.driver_name}" has historical trip logs. They have been deactivated and marked as INACTIVE.`,
        action: 'DEACTIVATED',
        driverId,
      });
      return;
    }

    // 3. If zero trips ever: attempt clean delete, fallback to INACTIVE
    try {
      const [result]: any = await pool.query('DELETE FROM drivers WHERE driver_id = ?', [driverId]);
      if (result.affectedRows > 0) {
        res.json({
          message: `Driver "${driver.driver_name}" has been permanently deleted.`,
          action: 'DELETED',
          driverId,
        });
        return;
      }
    } catch {
      // Fallback
    }

    await pool.query(
      "UPDATE drivers SET status = 'INACTIVE' WHERE driver_id = ?",
      [driverId]
    );
    res.json({
      message: `Driver "${driver.driver_name}" has been deactivated and marked as INACTIVE.`,
      action: 'DEACTIVATED',
      driverId,
    });
  } catch (error: any) {
    console.error('[FLEET_DRIVER_DELETE_ERROR]', error);
    res.status(500).json({ error: 'Failed to process driver deletion.' });
  }
}

