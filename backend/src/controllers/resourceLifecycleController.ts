import { Request, Response } from 'express';
import { pool } from '../config/db.js';

type ResourceType = 'bus' | 'driver' | 'route' | 'stop' | 'corridor';
const validType = (value: string): value is ResourceType =>
  ['bus', 'driver', 'route', 'stop', 'corridor'].includes(value);

const config: Record<ResourceType, { table: string; id: string; label: string; tripSql: string; activeTripSql: string; extraSql: string }> = {
  bus: { table: 'buses', id: 'bus_id', label: 'bus_no', tripSql: 'SELECT trip_id, trip_date, departure_time, trip_status FROM trips WHERE bus_id = ?', activeTripSql: "SELECT trip_id, trip_date, departure_time, trip_status FROM trips WHERE bus_id = ? AND trip_status IN ('SCHEDULED','PUBLISHED')", extraSql: 'SELECT COUNT(*) AS count FROM bookings b JOIN seats s ON s.seat_id = b.seat_id WHERE s.bus_id = ?' },
  driver: { table: 'drivers', id: 'driver_id', label: 'driver_name', tripSql: 'SELECT trip_id, trip_date, departure_time, trip_status FROM trips WHERE driver_id = ?', activeTripSql: "SELECT trip_id, trip_date, departure_time, trip_status FROM trips WHERE driver_id = ? AND trip_status IN ('SCHEDULED','PUBLISHED')", extraSql: '' },
  route: { table: 'routes', id: 'route_id', label: 'route_name', tripSql: 'SELECT trip_id, trip_date, departure_time, trip_status FROM trips WHERE route_id = ?', activeTripSql: "SELECT trip_id, trip_date, departure_time, trip_status FROM trips WHERE route_id = ? AND trip_status IN ('SCHEDULED','PUBLISHED')", extraSql: 'SELECT COUNT(*) AS count FROM routes WHERE paired_return_route_id = ?' },
  stop: { table: 'stops', id: 'stop_id', label: 'stop_name', tripSql: 'SELECT DISTINCT t.trip_id, t.trip_date, t.departure_time, t.trip_status FROM trips t JOIN route_stops rs ON rs.route_id = t.route_id WHERE rs.stop_id = ?', activeTripSql: "SELECT DISTINCT t.trip_id, t.trip_date, t.departure_time, t.trip_status FROM trips t JOIN route_stops rs ON rs.route_id = t.route_id WHERE rs.stop_id = ? AND t.trip_status IN ('SCHEDULED','PUBLISHED')", extraSql: 'SELECT COUNT(*) AS count FROM bookings WHERE boarding_stop_id = ?' },
  corridor: { table: 'route_corridors', id: 'corridor_id', label: 'corridor_name', tripSql: 'SELECT DISTINCT t.trip_id, t.trip_date, t.departure_time, t.trip_status FROM trips t JOIN routes r ON r.route_id = t.route_id WHERE r.corridor_id = ?', activeTripSql: "SELECT DISTINCT t.trip_id, t.trip_date, t.departure_time, t.trip_status FROM trips t JOIN routes r ON r.route_id = t.route_id WHERE r.corridor_id = ? AND t.trip_status IN ('SCHEDULED','PUBLISHED')", extraSql: 'SELECT COUNT(*) AS count FROM routes WHERE corridor_id = ?' },
};

export async function updateResourceStatus(req: Request, res: Response): Promise<void> {
  const type = req.params.type;
  const id = Number.parseInt(req.params.id, 10);
  const status = req.body.status;
  if (!validType(type) || !Number.isInteger(id) || id <= 0) { res.status(400).json({ error: 'Invalid resource type or ID.' }); return; }
  const allowed: Record<ResourceType, string[]> = {
    bus: ['ACTIVE', 'MAINTENANCE', 'RETIRED'],
    driver: ['ACTIVE', 'INACTIVE'],
    route: ['ACTIVE', 'INACTIVE'],
    stop: ['ACTIVE', 'INACTIVE'],
    corridor: ['ACTIVE', 'INACTIVE'],
  };
  if (!allowed[type].includes(status)) { res.status(400).json({ error: 'Invalid status for this resource.', allowed: allowed[type] }); return; }
  const c = config[type];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows]: any = await connection.query(`SELECT ${c.id}, ${c.label} FROM ${c.table} WHERE ${c.id} = ? FOR UPDATE`, [id]);
    if (!rows.length) { await connection.rollback(); res.status(404).json({ error: `${type} not found.` }); return; }
    const [trips]: any = await connection.query(c.activeTripSql, [id]);
    if (trips.length) {
      await connection.rollback();
      res.status(409).json({ error: `Cannot change ${type} status while scheduled/published trips use it. Resolve these trips manually first.`, dependencies: { trips } }); return;
    }
    await connection.query(`UPDATE ${c.table} SET status = ? WHERE ${c.id} = ?`, [status, id]);
    await connection.commit();
    res.json({ message: `${type} status updated successfully.`, id, status });
  } catch (error: any) {
    await connection.rollback();
    console.error('[RESOURCE_STATUS_UPDATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to update resource status.' });
  } finally { connection.release(); }
}

export async function deleteResource(req: Request, res: Response): Promise<void> {
  const type = req.params.type;
  const id = Number.parseInt(req.params.id, 10);
  if (!validType(type) || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid resource type or ID.' }); return;
  }
  const c = config[type];
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction(); transactionStarted = true;
    const [rows]: any = await connection.query(
      `SELECT ${c.id}, ${c.label} FROM ${c.table} WHERE ${c.id} = ? FOR UPDATE`, [id]
    );
    if (!rows.length) {
      await connection.rollback(); transactionStarted = false;
      res.status(404).json({ error: `${type} not found.` }); return;
    }

    const [trips]: any = await connection.query(c.tripSql, [id]);
    if (trips.length) {
      await connection.rollback(); transactionStarted = false;
      res.status(409).json({
        error: `Cannot delete ${type} "${rows[0][c.label]}": trip history still references it. Review and manually resolve the listed trips, then retry. No trip or passenger data was deleted.`,
        dependencies: { trips },
      });
      return;
    }

    // Never silently remove route/stop/corridor relationships. Show the exact records
    // so a manager can resolve them explicitly before retrying the deletion.
    if (type === 'route') {
      const [pairedRoutes]: any = await connection.query(
        'SELECT route_id, route_name FROM routes WHERE paired_return_route_id = ?', [id]
      );
      const [routeStops]: any = await connection.query(
        'SELECT rs.route_stop_id, rs.stop_id, s.stop_name, rs.stop_order FROM route_stops rs JOIN stops s ON s.stop_id = rs.stop_id WHERE rs.route_id = ? ORDER BY rs.stop_order',
        [id]
      );
      if (pairedRoutes.length || routeStops.length) {
        await connection.rollback(); transactionStarted = false;
        res.status(409).json({
          error: 'This route still has paired-route or stop-sequence dependencies. Resolve the listed relationships manually before deleting it.',
          dependencies: { routes: pairedRoutes, stops: routeStops },
        });
        return;
      }
    }

    if (type === 'stop') {
      const [routeRefs]: any = await connection.query(
        'SELECT rs.route_stop_id, r.route_id, r.route_name, rs.stop_order FROM route_stops rs JOIN routes r ON r.route_id = rs.route_id WHERE rs.stop_id = ? ORDER BY r.route_id, rs.stop_order',
        [id]
      );
      const [bookingRefs]: any = await connection.query(
        'SELECT booking_id, trip_id, booking_status FROM bookings WHERE boarding_stop_id = ? ORDER BY booking_id',
        [id]
      );
      if (routeRefs.length || bookingRefs.length) {
        await connection.rollback(); transactionStarted = false;
        res.status(409).json({
          error: 'This stop is still referenced by route sequences or boarding bookings. Resolve the listed relationships manually before deleting it.',
          dependencies: { routes: routeRefs, bookings: bookingRefs },
        });
        return;
      }
    }

    if (type === 'corridor') {
      const [routeRefs]: any = await connection.query(
        'SELECT route_id, route_name, direction FROM routes WHERE corridor_id = ? ORDER BY route_id', [id]
      );
      if (routeRefs.length) {
        await connection.rollback(); transactionStarted = false;
        res.status(409).json({
          error: 'This corridor still contains routes. Resolve or remove those route records manually before deleting the corridor.',
          dependencies: { routes: routeRefs },
        });
        return;
      }
    }

    if (type === 'bus') {
      const [bookingRefs]: any = await connection.query(
        'SELECT b.booking_id, b.trip_id, b.booking_status FROM bookings b JOIN seats s ON s.seat_id = b.seat_id WHERE s.bus_id = ? ORDER BY b.booking_id',
        [id]
      );
      if (bookingRefs.length) {
        await connection.rollback(); transactionStarted = false;
        res.status(409).json({
          error: 'This bus still has booking records associated with its seats. Resolve those records manually before deleting the bus.',
          dependencies: { bookings: bookingRefs },
        });
        return;
      }
      await connection.query('DELETE FROM seats WHERE bus_id = ?', [id]);
    }

    await connection.query(`DELETE FROM ${c.table} WHERE ${c.id} = ?`, [id]);
    await connection.commit(); transactionStarted = false;
    res.json({ message: `${type} "${rows[0][c.label]}" permanently deleted.`, id });
  } catch (error: any) {
    if (transactionStarted) { try { await connection.rollback(); } catch { /* preserve original error */ } }
    const fk = error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451;
    console.error('[RESOURCE_DELETE_ERROR]', error);
    res.status(fk ? 409 : 500).json({
      error: fk
        ? 'Other records still depend on this resource. Nothing was deleted; inspect and resolve the remaining references manually.'
        : 'Failed to delete resource.',
    });
  } finally {
    connection.release();
  }
}
