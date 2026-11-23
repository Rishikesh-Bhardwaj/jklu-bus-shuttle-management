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

    if (Array.isArray(stops) && stops.length > 0) {
      const stopInserts = stops.map((s: any, idx: number) => [
        routeId,
        s.stopId || s.stop_id,
        s.stopOrder || s.stop_order || idx + 1,
        s.estimatedOffsetMinutes || s.estimated_offset_minutes || 0,
      ]);

      await connection.query(
        `INSERT INTO route_stops (route_id, stop_id, stop_order, estimated_offset_minutes) VALUES ?`,
        [stopInserts]
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

