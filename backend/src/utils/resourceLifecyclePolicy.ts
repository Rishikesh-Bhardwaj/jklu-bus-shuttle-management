export type LifecycleResourceType = 'bus' | 'driver' | 'route' | 'stop' | 'corridor';

/**
 * Fleet resources and boarding stops cannot be deactivated while scheduled or
 * published trips depend on them. Routes and corridors may be deactivated;
 * their trips and passenger history remain stored but hidden from passengers.
 * Reactivation is always permitted so managers can restore existing services.
 */
export function shouldCheckTripDependenciesForStatusChange(
  type: LifecycleResourceType,
  currentStatus: string,
  nextStatus: string,
): boolean {
  const isDeactivating = currentStatus === 'ACTIVE' && nextStatus !== 'ACTIVE';
  return isDeactivating && type !== 'route' && type !== 'corridor';
}

export function isPassengerTripResourceAvailable(resources: {
  routeStatus: string | null | undefined;
  corridorStatus: string | null | undefined;
  busStatus: string | null | undefined;
  driverStatus: string | null | undefined;
}): boolean {
  return resources.routeStatus === 'ACTIVE' &&
    resources.corridorStatus === 'ACTIVE' &&
    resources.busStatus === 'ACTIVE' &&
    (resources.driverStatus == null || resources.driverStatus === 'ACTIVE');
}

export function isPassengerStopAvailable(status: string | null | undefined): boolean {
  return status === 'ACTIVE';
}
