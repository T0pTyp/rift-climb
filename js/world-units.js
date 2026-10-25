// Shared display/storage conversion. One meter is ten simulation world units.
export const METERS_PER_UNIT=.1;
export const worldMeters=y=>Math.floor(y*METERS_PER_UNIT+1e-6);
