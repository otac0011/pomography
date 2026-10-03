// Regional (not weather-driven) factors: where a disease or pest exists at all. Weather decides how bad it is *if present*;
// this module decides whether it is present. Everything here is a coarse, documented lookup, and the UI labels it as such.

/** Point-in-polygon, ray casting. poly = [[lon, lat], ...]. */
export function inPolygon(lon, lat, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// Native range of the eastern red cedar (Juniperus virginiana) and so of cedar-apple rust: roughly the central and eastern
// United States and southern Ontario/Quebec. Deliberately generous at the edges; the disease needs juniper hosts nearby.
const RUST_NA = [[-101, 28], [-101, 40.5], [-97.5, 44], [-96, 46], [-90, 47.5], [-84.5, 46.5], [-79, 46], [-73, 46], [-70, 45.5],
  [-67, 44.8], [-69.5, 43.5], [-70.5, 41.5], [-74, 39.5], [-76, 36.5], [-78.5, 33.5], [-81, 31], [-81, 29.5], [-82.7, 28.4],
  [-84.5, 29.8], [-88.5, 30.3], [-93.5, 29.6], [-97, 27.5]];
// Apple maggot (Rhagoletis pomonella): eastern North America, and since the 1980s the Pacific Northwest.
const MAGGOT_PNW = [[-124.5, 49], [-120, 49], [-120, 42], [-124.5, 42]];

// Fire blight (Erwinia amylovora) by country. 'present' = established; 'absent' = officially free; anything else = not mapped.
const FIRE_BLIGHT = {
  present: ['US', 'CA', 'MX', 'GB', 'IE', 'FR', 'DE', 'NL', 'BE', 'LU', 'DK', 'SE', 'NO', 'PL', 'CZ', 'SK', 'AT', 'CH', 'IT', 'ES', 'PT', 'GR', 'HU', 'RO', 'RS', 'HR', 'SI', 'BG', 'TR', 'IR', 'IL', 'LB', 'EG', 'NZ'],
  absent: ['AU', 'JP', 'CL'],
};

const BOXES = { AU: [-44, 112, -10, 154], JP: [30, 129, 46, 146] };       // [latMin, lonMin, latMax, lonMax] used only when no country code is known

export function guessCountry(lat, lon) {
  for (const [cc, [a, b, c, d]] of Object.entries(BOXES)) if (lat >= a && lat <= c && lon >= b && lon <= d) return cc;
  return null;
}

/**
 * Regional factors for a point. cc = ISO country code if known (from the reverse geocoder or the reference-place table).
 * Returns { country, fireBlight: {status, note}, rust: {present, note}, pests: [{name, note}] }
 */
export function regionalFor(lat, lon, cc) {
  const country = cc || guessCountry(lat, lon) || null;
  let fb = 'unknown';
  if (country && FIRE_BLIGHT.present.includes(country)) fb = 'present';
  else if (country && FIRE_BLIGHT.absent.includes(country)) fb = 'absent';
  const fireBlight = {
    status: fb,
    note: fb === 'present' ? 'Fire blight is established in this country, so weather decides how severe it is.'
      : fb === 'absent' ? 'Fire blight is not known to occur in this country; the risk shown is only what the weather would allow if it arrived.'
      : 'Fire blight status here is not mapped, so the weather-based risk is shown as if the disease were present.',
  };
  const rustPresent = inPolygon(lon, lat, RUST_NA);
  const rust = {
    present: rustPresent,
    note: rustPresent ? 'Cedar-apple rust occurs here: it needs eastern red cedar or juniper within a few hundred metres to complete its cycle.'
      : 'Cedar-apple rust is a North American disease of the central and eastern states and provinces; it does not occur at this location.',
  };
  const pests = [{ name: 'Codling moth', note: 'Occurs wherever apples are grown commercially; the commonest cause of maggoty fruit.' }];
  if (rustPresent || inPolygon(lon, lat, MAGGOT_PNW)) pests.push({ name: 'Apple maggot (Rhagoletis pomonella)', note: 'Native to eastern North America and now in the Pacific Northwest.' });
  if (rustPresent) pests.push({ name: 'Plum curculio', note: 'A beetle of eastern North America that scars young fruit.' });
  if (country === 'AU' || country === 'NZ') pests.push({ name: 'Light brown apple moth', note: 'Native to Australia and an established pest in New Zealand.' });
  return { country, fireBlight, rust, pests };
}
