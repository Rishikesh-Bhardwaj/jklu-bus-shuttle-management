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
  if (!validType(type) || !Number.isInteger(id) || id <= 0) { res.status(400).json({ error: 'Invalid resource type or ID.' }); return; }
  const c = config[type];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows]: any = await connection.query(`SELECT ${c.id}, ${c.label} FROM ${c.table} WHERE ${c.id} = ? FOR UPDATE`, [id]);
    if (!rows.length) { await connection.rollback(); res.status(404).json({ error: `${type} not found.` }); return; }
    const [trips]: any = await connection.query(c.tripSql, [id]);
    if (trips.length) {
      await connection.rollback();
      res.status(409).json({ error: `Cannot delete ${type} "${rows[0][c.label]}": trip history still references it. Review and manually resolve the listed trips, then retry. No trip or passenger data was deleted.`, dependencies: { trips } }); return;
    }
    if (type === 'stop') {
      const [routeRefs]: any = await connection.query('SELECT r.route_id, r.route_name FROM route_stops rs JOIN routes r ON r.route_id = rs.route_id WHERE rs.stop_id = ?', [id]);
      if (routeRefs.length) { await connection.rollback(); res.status(409).json({ error: 'This stop is still part of route sequences. Remove it from those routes manually before deleting the stop.', dependencies: { routes: routeRefs } }); return; }
    }
    if (c.extraSql) {
      const [extra]: any = await connection.query(c.extraSql, [id]);
      const count = Number(extra[0]?.count || 0);
      if (count) { await connection.rollback(); res.status(409).json({ error: `Cannot delete ${type}: ${count} dependent record(s) still reference it. Resolve those records manually first. No data was changed.`, dependencies: { count } }); return; }
    }
    if (type === 'route') await connection.query('DELETE FROM route_stops WHERE route_id = ?', [id]);
    if (type === 'bus') await connection.query('DELETE FROM seats WHERE bus_id = ?', [id]);
    await connection.query(`DELETE FROM ${c.table} WHERE ${c.id} = ?`, [id]);
    await connection.commit();
    res.json({ message: `${type} "${rows[0][c.label]}" permanently deleted.`, id });
  } catch (error: any) {
    await connection.rollback();
    const fk = error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451;
    res.status(fk ? 409 : 500).json({ error: fk ? 'Other records still depend on this resource. Nothing was deleted.' : 'Failed to delete resource.' });
  } finally { connection.release(); }
}
