const EARTH_RADIUS_KM = 6371.0088;
const radians = (degrees) => degrees * Math.PI / 180;
const degrees = (radiansValue) => radiansValue * 180 / Math.PI;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function distanceKm(a, b) {
  const dLat = radians(Number(b.latitude) - Number(a.latitude));
  const dLon = radians(Number(b.longitude) - Number(a.longitude));
  const lat1 = radians(Number(a.latitude)); const lat2 = radians(Number(b.latitude));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(clamp(h, 0, 1)));
}

function bearing(a, b) {
  const lat1 = radians(Number(a.latitude)); const lat2 = radians(Number(b.latitude));
  const dLon = radians(Number(b.longitude) - Number(a.longitude));
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

// Great-circle interpolation. It is an academic approximation, not road geometry.
function interpolate(a, b, fraction) {
  const f = clamp(fraction, 0, 1); const lat1 = radians(Number(a.latitude)); const lon1 = radians(Number(a.longitude)); const lat2 = radians(Number(b.latitude)); const lon2 = radians(Number(b.longitude));
  if (f === 0) return { latitude: Number(a.latitude), longitude: Number(a.longitude) };
  if (f === 1) return { latitude: Number(b.latitude), longitude: Number(b.longitude) };
  const angle = distanceKm(a, b) / EARTH_RADIUS_KM;
  if (angle < 1e-12) return { latitude: Number(a.latitude), longitude: Number(a.longitude) };
  const sinAngle = Math.sin(angle); const first = Math.sin((1 - f) * angle) / sinAngle; const second = Math.sin(f * angle) / sinAngle;
  const x = first * Math.cos(lat1) * Math.cos(lon1) + second * Math.cos(lat2) * Math.cos(lon2);
  const y = first * Math.cos(lat1) * Math.sin(lon1) + second * Math.cos(lat2) * Math.sin(lon2);
  const z = first * Math.sin(lat1) + second * Math.sin(lat2);
  return { latitude: degrees(Math.atan2(z, Math.sqrt(x * x + y * y))), longitude: degrees(Math.atan2(y, x)) };
}

module.exports = { bearing, distanceKm, interpolate };
