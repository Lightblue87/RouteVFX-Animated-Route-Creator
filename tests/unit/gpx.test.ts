import { describe, expect, it } from 'vitest';
import { GpxError, parseGpx, sanitizeLabel, simplify } from '../../src/features/imports/gpx';

const TRK = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="52.37" lon="9.73"><name>Start</name></wpt>
  <trk><name>Tour &lt;script&gt;alert(1)&lt;/script&gt;</name>
    <trkseg>
      <trkpt lat="52.3700" lon="9.7300"><ele>55</ele><time>2026-05-01T08:00:00Z</time></trkpt>
      <trkpt lat="52.3800" lon="9.7400"><ele>56</ele><time>2026-05-01T08:05:00Z</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="52.3900" lon="9.7500"><time>2026-05-01T08:10:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('GPX import', () => {
  it('parses tracks with elevation and real times; single-point sections are skipped with a warning', () => {
    const r = parseGpx(TRK);
    expect(r.tracks).toHaveLength(1);
    const t = r.tracks[0]!;
    expect(t.points).toHaveLength(2);
    expect(t.points[0]!.altitudeM).toBe(55);
    expect(t.durationS).toBe(300);
    expect(r.waypoints[0]!.name).toBe('Start');
    expect(r.warnings).toContain('track_segment_too_short');
  });
  it('keeps spatially separated <trkseg> apart instead of counting the gap as travelled distance', () => {
    const gpx = `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Lücke</name>
      <trkseg><trkpt lat="52.000" lon="9.000"/><trkpt lat="52.010" lon="9.000"/></trkseg>
      <trkseg><trkpt lat="41.000" lon="2.000"/><trkpt lat="41.010" lon="2.000"/></trkseg>
    </trk></gpx>`;
    const r = parseGpx(gpx);
    expect(r.tracks).toHaveLength(2);
    expect(r.tracks.map((t) => t.name)).toEqual(['Lücke (1/2)', 'Lücke (2/2)']);
    for (const t of r.tracks) expect(t.distanceM).toBeLessThan(1_200);
    expect(r.warnings).toContain('track_gaps_kept');
  });
  it('keeps markup in names as inert text (no HTML interpretation)', () => {
    expect(parseGpx(TRK).tracks[0]!.name).toBe('Tour <script>alert(1)</script>');
  });
  it('does not invent timestamps when some are missing', () => {
    const gpx = TRK.replace('<time>2026-05-01T08:05:00Z</time>', '');
    expect(parseGpx(gpx).tracks[0]!.durationS).toBeUndefined();
  });
  it('parses routes (rte/rtept) and GPX 1.0', () => {
    const r = parseGpx(`<gpx xmlns="http://www.topografix.com/GPX/1/0" version="1.0"><rte><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2.1"/></rte></gpx>`);
    expect(r.tracks[0]!.points).toHaveLength(2);
    expect(r.tracks[0]!.durationS).toBeUndefined();
  });
  it('skips out-of-range coordinates', () => {
    const r = parseGpx(`<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="95" lon="2"/><trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2.1"/></trkseg></trk></gpx>`);
    expect(r.tracks[0]!.points).toHaveLength(2);
    expect(r.warnings).toContain('invalid_coordinates_skipped');
  });
  it('rejects invalid XML, non-GPX, DOCTYPE/ENTITY, empty files and oversize input', () => {
    const code = (f: () => unknown) => { try { f(); return 'none'; } catch (e) { return (e as GpxError).code; } };
    expect(code(() => parseGpx('<gpx><trk>'))).toBe('invalid_xml');
    expect(code(() => parseGpx('<kml></kml>'))).toBe('not_gpx');
    expect(code(() => parseGpx('<!DOCTYPE gpx [<!ENTITY a "aaaa">]><gpx>&a;</gpx>'))).toBe('invalid_xml');
    expect(code(() => parseGpx('<gpx xmlns="http://www.topografix.com/GPX/1/1"></gpx>'))).toBe('no_points');
    expect(code(() => parseGpx('<gpx/>', 100 * 1024 * 1024))).toBe('too_large');
  });
  it('sanitizeLabel strips control characters and truncates', () => {
    expect(sanitizeLabel('a\u0000b\nc', 80)).toBe('a b c');
    expect(sanitizeLabel('x'.repeat(200))).toHaveLength(80);
  });
  it('simplify keeps endpoints and drops collinear points', () => {
    const pts = Array.from({ length: 100 }, (_, i) => ({ lat: 0, lon: i * 0.001 }));
    const s = simplify(pts);
    expect(s[0]).toEqual(pts[0]);
    expect(s[s.length - 1]).toEqual(pts[99]);
    expect(s.length).toBe(2);
  });
});
