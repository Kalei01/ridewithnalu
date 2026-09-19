/**
 * Minimal dependency-free GTFS-Realtime (protobuf) reader for TripUpdates.
 *
 * The Worker runtime that serves this app disallows the runtime code generation
 * that protobufjs-based bindings rely on, so the handful of fields we need are
 * decoded directly from the wire format.
 */

type Field = { wire: number; value: bigint; bytes?: Uint8Array };
type Message = Map<number, Field[]>;

function readVarint(buf: Uint8Array, offset: number): [bigint, number] {
  let result = 0n;
  let shift = 0n;
  let index = offset;
  for (;;) {
    const byte = buf[index];
    if (byte === undefined) throw new Error("Malformed protobuf varint");
    index += 1;
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7n;
  }
  return [result, index];
}

function decodeMessage(buf: Uint8Array): Message {
  const fields: Message = new Map();
  let offset = 0;
  while (offset < buf.length) {
    const [tag, afterTag] = readVarint(buf, offset);
    offset = afterTag;
    const fieldNumber = Number(tag >> 3n);
    const wire = Number(tag & 0x7n);
    let field: Field;
    if (wire === 0) {
      const [value, next] = readVarint(buf, offset);
      offset = next;
      field = { wire, value };
    } else if (wire === 2) {
      const [length, next] = readVarint(buf, offset);
      const start = next;
      const end = start + Number(length);
      offset = end;
      field = { wire, value: 0n, bytes: buf.subarray(start, end) };
    } else if (wire === 5) {
      offset += 4;
      field = { wire, value: 0n };
    } else if (wire === 1) {
      offset += 8;
      field = { wire, value: 0n };
    } else {
      throw new Error(`Unsupported protobuf wire type ${wire}`);
    }
    const existing = fields.get(fieldNumber);
    if (existing) existing.push(field);
    else fields.set(fieldNumber, [field]);
  }
  return fields;
}

const sub = (message: Message, field: number): Message[] =>
  (message.get(field) ?? [])
    .filter((entry) => entry.bytes)
    .map((entry) => decodeMessage(entry.bytes!));

const str = (message: Message, field: number): string | null => {
  const bytes = message.get(field)?.[0]?.bytes;
  return bytes ? new TextDecoder().decode(bytes) : null;
};

/** Varints carry int32 values as two's-complement 64-bit. */
const int = (message: Message, field: number): number | null => {
  const entry = message.get(field)?.[0];
  if (!entry || entry.wire !== 0) return null;
  const value = entry.value;
  return Number(value >= 1n << 63n ? value - (1n << 64n) : value);
};

export type TripUpdateRow = {
  trip_id: string;
  stop_id: string;
  delay_seconds: number;
};

/** Extracts one row per (trip_id, stop_id) with the delay in seconds. */
export function parseTripUpdates(buffer: Uint8Array): TripUpdateRow[] {
  const feed = decodeMessage(buffer);
  const rows = new Map<string, TripUpdateRow>();

  for (const entity of sub(feed, 2)) {
    for (const tripUpdate of sub(entity, 3)) {
      const trip = sub(tripUpdate, 1)[0];
      const tripId = trip ? str(trip, 1) : null;
      if (!tripId) continue;
      const tripDelay = int(tripUpdate, 5);

      for (const stopTimeUpdate of sub(tripUpdate, 2)) {
        const stopId = str(stopTimeUpdate, 4);
        if (!stopId) continue;
        const departure = sub(stopTimeUpdate, 3)[0];
        const arrival = sub(stopTimeUpdate, 2)[0];
        const delay =
          (departure ? int(departure, 1) : null) ??
          (arrival ? int(arrival, 1) : null) ??
          tripDelay;
        if (delay === null) continue;
        rows.set(`${tripId}|${stopId}`, {
          trip_id: tripId,
          stop_id: stopId,
          delay_seconds: delay,
        });
      }
    }
  }

  return [...rows.values()];
}
