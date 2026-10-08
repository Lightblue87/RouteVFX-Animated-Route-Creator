import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCoordinates, searchOffline } from '../../src/adapters/geocoding';

const places = JSON.parse(readFileSync('public/geodata/places.json', 'utf8'));
const airports = JSON.parse(readFileSync('public/geodata/airports.json', 'utf8'));

describe('offline geocoding (Natural Earth)', () => {
  it('finds Hannover via German alias, Barcelona (ES first), Palma', () => {
    expect(searchOffline(places, airports, 'Hannover')[0]!.name).toBe('Hanover');
    const bcn = searchOffline(places, airports, 'Barcelona');
    expect(bcn[0]!.detail).toBe('ES');
    expect(searchOffline(places, airports, 'Palma').some((p) => p.detail === 'ES')).toBe(true);
  });
  it('finds airports by IATA code', () => {
    expect(searchOffline(places, airports, 'PMI')[0]!.name).toMatch(/PMI/);
  });
  it('parses coordinate input and rejects out of range', () => {
    expect(parseCoordinates('52.37, 9.73')).toEqual({ lat: 52.37, lon: 9.73 });
    expect(parseCoordinates('95, 9')).toBeNull();
    expect(searchOffline(places, airports, '52.37, 9.73')[0]!.source).toBe('coordinates');
  });
});
