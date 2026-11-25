import { Request, Response } from 'express';
import { pool } from '../config/db.js';

// ======================== CORRIDORS ========================

export async function listCorridors(req: Request, res: Response): Promise<void> {
  try {
    const [rows]: any = await pool.query(
      `SELECT corridor_id, corridor_name, description, created_at FROM route_corridors ORDER BY corridor_name ASC`
    );
    res.json({ corridors: rows });
  } catch (error: any) {
    console.error('[ROUTE_CORRIDORS_LIST_ERROR]', error);
    res.status(500).json({ error: 'Failed to list corridors.' });
  }
}

export async function createCorridor(req: Request, res: Response): Promise<void> {
  try {
    const { corridorName, description } = req.body;
    if (!corridorName) {
      res.status(400).json({ error: 'Corridor name is required.' });
      return;
    }

    const [result]: any = await pool.query(
      `INSERT INTO route_corridors (corridor_name, description) VALUES (?, ?)`,
      [corridorName.trim(), description?.trim() || null]
    );

    res.status(201).json({
      message: 'Corridor created successfully.',
      corridor: { corridor_id: result.insertId, corridor_name: corridorName.trim(), description },
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: `Corridor "${req.body.corridorName}" already exists.` });
      return;
    }
    console.error('[ROUTE_CORRIDOR_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to create corridor.' });
  }
}

// ======================== STOPS ========================

export async function listStops(req: Request, res: Response): Promise<void> {
  try {
    const [rows]: any = await pool.query(
      `SELECT stop_id, stop_name, created_at FROM stops ORDER BY stop_name ASC`
    );
    res.json({ stops: rows });
  } catch (error: any) {
    console.error('[ROUTE_STOPS_LIST_ERROR]', error);
    res.status(500).json({ error: 'Failed to list stops.' });
  }
}

export async function createStop(req: Request, res: Response): Promise<void> {
  try {
    const { stopName } = req.body;
    if (!stopName) {
      res.status(400).json({ error: 'Stop name is required.' });
      return;
    }

    const [result]: any = await pool.query(
      `INSERT INTO stops (stop_name) VALUES (?)`,
      [stopName.trim()]
    );

    res.status(201).json({
      message: 'Stop created successfully.',
      stop: { stop_id: result.insertId, stop_name: stopName.trim() },
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: `Stop "${req.body.stopName}" already exists.` });
      return;
    }
    console.error('[ROUTE_STOP_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to create stop.' });
  }
}

// ======================== ROUTES ========================

export async function listRoutes(req: Request, res: Response): Promise<void> {
  try {
    const [routes]: any = await pool.query(
      `SELECT r.route_id, r.corridor_id, c.corridor_name, r.paired_return_route_id,
              r.route_name, r.origin, r.destination, r.direction, r.created_at,
              pr.route_name AS paired_route_name
       FROM routes r
       JOIN route_corridors c ON r.corridor_id = c.corridor_id
       LEFT JOIN routes pr ON r.paired_return_route_id = pr.route_id
       ORDER BY c.corridor_name ASC, r.direction ASC, r.route_name ASC`
    );

    // Fetch all route stops
    const [stops]: any = await pool.query(
      `SELECT rs.route_stop_id, rs.route_id, rs.stop_id, rs.stop_order, rs.estimated_offset_minutes,
              s.stop_name
       FROM route_stops rs
       JOIN stops s ON rs.stop_id = s.stop_id
       ORDER BY rs.route_id ASC, rs.stop_order ASC`
    );

    const stopMap = new Map<number, any[]>();
    for (const s of stops) {
      if (!stopMap.has(s.route_id)) stopMap.set(s.route_id, []);
      stopMap.get(s.route_id)!.push(s);
    }

    const result = routes.map((r: any) => ({
      ...r,
      stops: stopMap.get(r.route_id) || [],
    }));

    res.json({ routes: result });
  } catch (error: any) {
    console.error('[ROUTE_LIST_ERROR]', error);
    res.status(500).json({ error: 'Failed to list routes.' });
  }
}

export async function getRouteById(req: Request, res: Response): Promise<void> {
  try {
    const routeId = parseInt(req.params.id, 10);
    const [routes]: any = await pool.query(
      `SELECT r.route_id, r.corridor_id, c.corridor_name, r.paired_return_route_id,
              r.route_name, r.origin, r.destination, r.direction, r.created_at
       FROM routes r
       JOIN route_corridors c ON r.corridor_id = c.corridor_id
       WHERE r.route_id = ?`,
      [routeId]
    );

    if (routes.length === 0) {
      res.status(404).json({ error: 'Route not found.' });
      return;
    }

    const [stops]: any = await pool.query(
      `SELECT rs.route_stop_id, rs.route_id, rs.stop_id, rs.stop_order, rs.estimated_offset_minutes,
              s.stop_name
       FROM route_stops rs
       JOIN stops s ON rs.stop_id = s.stop_id
       WHERE rs.route_id = ?
       ORDER BY rs.stop_order ASC`,
      [routeId]
    );

    res.json({ route: { ...routes[0], stops } });
  } catch (error: any) {
    console.error('[ROUTE_GET_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve route.' });
  }
}

export async function createRoute(req: Request, res: Response): Promise<void> {
  const { corridorId, routeName, origin, destination, direction, pairedReturnRouteId, stops } = req.body;

  if (!corridorId || !routeName || !origin || !destination || !direction) {
    res.status(400).json({ error: 'corridorId, routeName, origin, destination, and direction are required.' });
    return;
  }

  if (!['OUTBOUND', 'RETURN'].includes(direction)) {
    res.status(400).json({ error: 'direction must be OUTBOUND or RETURN.' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [routeResult]: any = await connection.query(
      `INSERT INTO routes (corridor_id, paired_return_route_id, route_name, origin, destination, direction)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [corridorId, pairedReturnRouteId || null, routeName.trim(), origin.trim(), destination.trim(), direction]
    );

    const routeId = routeResult.insertId;

    let routeStopsToInsert: any[] = [];
    if (Array.isArray(stops) && stops.length > 0) {
      routeStopsToInsert = stops.map((s: any, idx: number) => {
        const stopId = typeof s === 'object' ? (s.stopId || s.stop_id) : s;
        const stopOrder = (typeof s === 'object' && (s.stopOrder || s.stop_order)) ? (s.stopOrder || s.stop_order) : idx + 1;
        const offset = (typeof s === 'object' && (s.estimatedOffsetMinutes || s.estimated_offset_minutes !== undefined))
          ? (s.estimatedOffsetMinutes || s.estimated_offset_minutes)
          : idx * 10;
        return [routeId, stopId, stopOrder, offset];
      });
    } else {
      // Auto-register origin and destination stops if stops array was not provided
      let originStopId: number;
      const [originRows]: any = await connection.query('SELECT stop_id FROM stops WHERE LOWER(stop_name) = LOWER(?)', [origin.trim()]);
      if (originRows.length > 0) {
        originStopId = originRows[0].stop_id;
      } else {
        const [newOrigin]: any = await connection.query('INSERT INTO stops (stop_name) VALUES (?)', [origin.trim()]);
        originStopId = newOrigin.insertId;
      }

      let destStopId: number;
      const [destRows]: any = await connection.query('SELECT stop_id FROM stops WHERE LOWER(stop_name) = LOWER(?)', [destination.trim()]);
      if (destRows.length > 0) {
        destStopId = destRows[0].stop_id;
      } else {
        const [newDest]: any = await connection.query('INSERT INTO stops (stop_name) VALUES (?)', [destination.trim()]);
        destStopId = newDest.insertId;
      }

      routeStopsToInsert = [
        [routeId, originStopId, 1, 0],
        [routeId, destStopId, 2, 45],
      ];
    }

    if (routeStopsToInsert.length > 0) {
      await connection.query(
        `INSERT INTO route_stops (route_id, stop_id, stop_order, estimated_offset_minutes) VALUES ?`,
        [routeStopsToInsert]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: 'Route registered successfully.',
      routeId,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('[ROUTE_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to create route.' });
  } finally {
    connection.release();
  }
}

/**
 * DELETE /api/routes/:id
 * MANAGER only: Delete a route if it has no associated trips.
 */
export async function deleteRoute(req: Request, res: Response): Promise<void> {
  try {
    const routeId = parseInt(req.params.id, 10);
    if (isNaN(routeId)) {
      res.status(400).json({ error: 'Invalid route ID.' });
      return;
    }

    const [routes]: any = await pool.query(
      'SELECT route_id, route_name FROM routes WHERE route_id = ?',
      [routeId]
    );

    if (routes.length === 0) {
      res.status(404).json({ error: 'Route not found.' });
      return;
    }

    const route = routes[0];

    // 1. Check if referenced by trips
    const [trips]: any = await pool.query(
      'SELECT COUNT(*) AS count FROM trips WHERE route_id = ?',
      [routeId]
    );

    if (trips[0].count > 0) {
      res.status(409).json({
        error: `Cannot delete route "${route.route_name}": It is referenced by ${trips[0].count} scheduled or historical trip(s). Deleting this route would break trip schedules and passenger booking records.`,
      });
      return;
    }

    // 2. Check if paired with another route
    const [paired]: any = await pool.query(
      'SELECT route_id, route_name FROM routes WHERE paired_return_route_id = ?',
      [routeId]
    );

    if (paired.length > 0) {
      res.status(400).json({
        error: `Cannot delete route "${route.route_name}": It is set as the return route for "${paired[0].route_name}". Unpair or update that route first.`,
      });
      return;
    }

    // 3. Delete route stops and the route
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM route_stops WHERE route_id = ?', [routeId]);
      await connection.query('DELETE FROM routes WHERE route_id = ?', [routeId]);
      await connection.commit();
      res.json({
        message: `Route "${route.route_name}" and its stop sequences have been deleted successfully.`,
        routeId,
      });
    } catch (delErr: any) {
      await connection.rollback();
      const isForeignKey = delErr.code === 'ER_ROW_IS_REFERENCED_2' || delErr.errno === 1451;
      res.status(isForeignKey ? 409 : 500).json({
        error: isForeignKey
          ? 'Cannot delete this route because another record still depends on it. No data was changed.'
          : `Failed to delete route: ${delErr.message}`,
      });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('[ROUTE_DELETE_ERROR]', error);
    res.status(500).json({ error: 'Failed to process route deletion.' });
  }
}

/**
 * DELETE /api/routes/stops/:id
 * MANAGER only: Delete a bus stop if not used in routes or bookings.
 */
export async function deleteStop(req: Request, res: Response): Promise<void> {
  try {
    const stopId = parseInt(req.params.id, 10);
    if (isNaN(stopId)) {
      res.status(400).json({ error: 'Invalid stop ID.' });
      return;
    }

    const [stops]: any = await pool.query(
      'SELECT stop_id, stop_name FROM stops WHERE stop_id = ?',
      [stopId]
    );

    if (stops.length === 0) {
      res.status(404).json({ error: 'Stop not found.' });
      return;
    }

    const stop = stops[0];

    // 1. Check if assigned to any route_stops
    const [routeRefs]: any = await pool.query(
      `SELECT r.route_name FROM route_stops rs 
       JOIN routes r ON rs.route_id = r.route_id 
       WHERE rs.stop_id = ?`,
      [stopId]
    );

    if (routeRefs.length > 0) {
      const sampleNames = routeRefs.map((r: any) => r.route_name).slice(0, 3).join(', ');
      res.status(409).json({
        error: `Cannot delete stop "${stop.stop_name}": It is currently assigned to ${routeRefs.length} route(s) (${sampleNames}). Remove it from route sequences first.`,
      });
      return;
    }

    // 2. Check if referenced in passenger bookings
    const [bookingRefs]: any = await pool.query(
      'SELECT COUNT(*) AS count FROM bookings WHERE boarding_stop_id = ?',
      [stopId]
    );

    if (bookingRefs[0].count > 0) {
      res.status(400).json({
        error: `Cannot delete stop "${stop.stop_name}": It is referenced as boarding stop in ${bookingRefs[0].count} passenger booking(s).`,
      });
      return;
    }

    // 3. Delete stop
    await pool.query('DELETE FROM stops WHERE stop_id = ?', [stopId]);
    res.json({
      message: `Stop "${stop.stop_name}" deleted successfully.`,
      stopId,
    });
  } catch (error: any) {
    const isForeignKey = error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451;
    console.error('[STOP_DELETE_ERROR]', error);
    res.status(isForeignKey ? 409 : 500).json({
      error: isForeignKey
        ? 'Cannot delete this stop because another record still depends on it. No data was changed.'
        : 'Failed to process stop deletion.',
    });
  }
}

/**
 * DELETE /api/routes/corridors/:id
 * MANAGER only: Delete a corridor if no routes are assigned.
 */
export async function deleteCorridor(req: Request, res: Response): Promise<void> {
  try {
    const corridorId = parseInt(req.params.id, 10);
    if (isNaN(corridorId)) {
      res.status(400).json({ error: 'Invalid corridor ID.' });
      return;
    }

    const [corridors]: any = await pool.query(
      'SELECT corridor_id, corridor_name FROM route_corridors WHERE corridor_id = ?',
      [corridorId]
    );

    if (corridors.length === 0) {
      res.status(404).json({ error: 'Corridor not found.' });
      return;
    }

    const corridor = corridors[0];

    // Check if assigned to any routes
    const [routeRefs]: any = await pool.query(
      'SELECT route_name FROM routes WHERE corridor_id = ?',
      [corridorId]
    );

    if (routeRefs.length > 0) {
      const sampleNames = routeRefs.map((r: any) => r.route_name).slice(0, 3).join(', ');
      res.status(409).json({
        error: `Cannot delete corridor "${corridor.corridor_name}": It contains ${routeRefs.length} route(s) (${sampleNames}). Delete or reassign those routes first.`,
      });
      return;
    }

    await pool.query('DELETE FROM route_corridors WHERE corridor_id = ?', [corridorId]);
    res.json({
      message: `Corridor "${corridor.corridor_name}" deleted successfully.`,
      corridorId,
    });
  } catch (error: any) {
    const isForeignKey = error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451;
    console.error('[CORRIDOR_DELETE_ERROR]', error);
    res.status(isForeignKey ? 409 : 500).json({
      error: isForeignKey
        ? 'Cannot delete this corridor because another record still depends on it. No data was changed.'
        : 'Failed to process corridor deletion.',
    });
  }
}

