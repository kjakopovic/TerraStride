const EARTH_RADIUS = 6378137;
const ORIGIN_SHIFT = (Math.PI * EARTH_RADIUS) / 180;
export const GRID_SIZE_METERS = 100;

export type LatLng = { latitude: number; longitude: number };

export type GridSquare = {
  id: string;
  corners: LatLng[];
  centroid: LatLng;
};

const lonToMeters = (lon: number) => lon * ORIGIN_SHIFT;
const latToMeters = (lat: number) =>
  Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * EARTH_RADIUS;
const metersToLon = (x: number) => x / ORIGIN_SHIFT;
const metersToLat = (y: number) =>
  (Math.atan(Math.exp(y / EARTH_RADIUS)) * 360) / Math.PI - 90;

export const latLngToGridSquare = (
  latitude: number,
  longitude: number,
  gridSizeMeters: number = GRID_SIZE_METERS
): GridSquare => {
  const x = lonToMeters(longitude);
  const y = latToMeters(latitude);

  const gridX = Math.floor(x / gridSizeMeters);
  const gridY = Math.floor(y / gridSizeMeters);

  const minX = gridX * gridSizeMeters;
  const maxX = (gridX + 1) * gridSizeMeters;
  const minY = gridY * gridSizeMeters;
  const maxY = (gridY + 1) * gridSizeMeters;

  const corners: LatLng[] = [
    { latitude: metersToLat(minY), longitude: metersToLon(minX) }, // SW
    { latitude: metersToLat(minY), longitude: metersToLon(maxX) }, // SE
    { latitude: metersToLat(maxY), longitude: metersToLon(maxX) }, // NE
    { latitude: metersToLat(maxY), longitude: metersToLon(minX) }, // NW
  ];

  const centroid: LatLng = {
    latitude: metersToLat((minY + maxY) / 2),
    longitude: metersToLon((minX + maxX) / 2),
  };

  return { id: `${gridX}_${gridY}`, corners, centroid };
};

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
