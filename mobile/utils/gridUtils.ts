const EARTH_RADIUS = 6378137;
const ORIGIN_SHIFT = Math.PI * EARTH_RADIUS;
export const GRID_SIZE_METERS = 100;

export type LatLng = { latitude: number; longitude: number };

export type GridSquare = {
  id: string;
  corners: LatLng[];
  centroid: LatLng;
};

const lonToMeters = (lon: number) => (lon * ORIGIN_SHIFT) / 180;

const latToMeters = (lat: number) => {
  const latRad = (lat * Math.PI) / 180;
  return EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
};

const metersToLon = (x: number) => (x / ORIGIN_SHIFT) * 180;

const metersToLat = (y: number) => {
  const latRad = Math.PI / 2 - 2 * Math.atan(Math.exp(-y / EARTH_RADIUS));
  return (latRad * 180) / Math.PI;
};

const buildSquareFromIndices = (
  gridX: number,
  gridY: number,
  gridSizeMeters: number
): GridSquare => {
  const minX = gridX * gridSizeMeters;
  const maxX = (gridX + 1) * gridSizeMeters;
  const minY = gridY * gridSizeMeters;
  const maxY = (gridY + 1) * gridSizeMeters;

  const corners: LatLng[] = [
    { latitude: metersToLat(minY), longitude: metersToLon(minX) },
    { latitude: metersToLat(minY), longitude: metersToLon(maxX) },
    { latitude: metersToLat(maxY), longitude: metersToLon(maxX) },
    { latitude: metersToLat(maxY), longitude: metersToLon(minX) },
  ];

  const centroid: LatLng = {
    latitude: metersToLat((minY + maxY) / 2),
    longitude: metersToLon((minX + maxX) / 2),
  };

  return { id: `${gridX}_${gridY}`, corners, centroid };
};

export const latLngToGridSquare = (
  latitude: number,
  longitude: number,
  gridSizeMeters: number = GRID_SIZE_METERS
): GridSquare => {
  const x = lonToMeters(longitude);
  const y = latToMeters(latitude);

  const gridX = Math.floor(x / gridSizeMeters);
  const gridY = Math.floor(y / gridSizeMeters);

  return buildSquareFromIndices(gridX, gridY, gridSizeMeters);
};

export const gridIndicesToSquare = (
  gridX: number,
  gridY: number,
  gridSizeMeters: number = GRID_SIZE_METERS
): GridSquare => buildSquareFromIndices(gridX, gridY, gridSizeMeters);

export const gridSquareToPolygon = (square: GridSquare) => [
  ...square.corners,
  square.corners[0],
];

export const createRegionFromPosition = (
  position: LatLng,
  delta: number = 0.01
) => ({
  latitude: position.latitude,
  longitude: position.longitude,
  latitudeDelta: delta,
  longitudeDelta: delta,
});
