/**
 * Centralized utility to extract and compute telemetry freshness from a tourist object.
 * Returns normalized coordinates, timestamps, raw status, and evaluated UI status.
 *
 * Evaluated Statuses:
 * - 'active' (🟢 GPS Active): gpsStatus === 'active' AND telemetry is <= 5 minutes old
 * - 'stale' (🟡 Stale / Signal Lost): gpsStatus === 'active' BUT telemetry is > 5 minutes old
 * - 'disabled' (🔴 GPS Offline): gpsStatus === 'disabled' or 'unavailable'
 * - 'none' (⚪ No GPS Status): missing/null telemetry
 */
export function getTouristTelemetry(tourist) {
    if (!tourist) {
        return {
            gpsStatus: 'none',
            evaluatedStatus: 'none',
            statusLabel: 'No GPS Status',
            statusBadgeClass: 'text-muted',
            statusIcon: '⚪',
            coordinates: null,
            accuracy: null,
            timestamp: null,
            formattedTimestamp: null,
            isStale: false,
            ageInSeconds: null
        };
    }

    // 1. Raw status extraction
    const rawStatus = (tourist.gpsStatus || tourist.locationStatus || '').toString().toLowerCase().trim();

    // 2. Coordinate & accuracy extraction
    let lat = null, lng = null, accuracy = null, rawTimestamp = null;
    if (tourist.lastKnownLocation && typeof tourist.lastKnownLocation === 'object') {
        lat = tourist.lastKnownLocation.latitude ?? tourist.lastKnownLocation.lat;
        lng = tourist.lastKnownLocation.longitude ?? tourist.lastKnownLocation.lng;
        accuracy = tourist.lastKnownLocation.accuracy;
        rawTimestamp = tourist.lastKnownLocation.timestamp;
    }
    if (lat == null || lng == null) {
        lat = tourist.latitude ?? tourist.lat ?? tourist.lastKnownLatitude;
        lng = tourist.longitude ?? tourist.lng ?? tourist.lastKnownLongitude;
    }
    if (accuracy == null) {
        accuracy = tourist.accuracy ?? tourist.gpsAccuracy;
    }

    let coordinates = null;
    if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
        coordinates = {
            latitude: Number(lat),
            longitude: Number(lng)
        };
    }

    // 3. Timestamp normalization
    const effectiveTimestampRaw = rawTimestamp || tourist.lastLocationStatusUpdate || tourist.updatedAt;
    let parsedDate = null;

    if (effectiveTimestampRaw) {
        if (effectiveTimestampRaw instanceof Date) {
            parsedDate = effectiveTimestampRaw;
        } else if (typeof effectiveTimestampRaw === 'string') {
            parsedDate = new Date(effectiveTimestampRaw);
        } else if (typeof effectiveTimestampRaw === 'number') {
            parsedDate = new Date(effectiveTimestampRaw > 1e11 ? effectiveTimestampRaw : effectiveTimestampRaw * 1000);
        } else if (typeof effectiveTimestampRaw === 'object') {
            // Firestore Timestamp object {_seconds, _nanoseconds} or {seconds, nanoseconds}
            const secs = effectiveTimestampRaw._seconds ?? effectiveTimestampRaw.seconds;
            if (secs != null) {
                parsedDate = new Date(secs * 1000);
            } else if (typeof effectiveTimestampRaw.toDate === 'function') {
                parsedDate = effectiveTimestampRaw.toDate();
            }
        }
    }

    let ageInSeconds = null;
    let isStale = false;

    if (parsedDate && !isNaN(parsedDate.getTime())) {
        const nowMs = Date.now();
        ageInSeconds = Math.max(0, Math.floor((nowMs - parsedDate.getTime()) / 1000));
        // Stale threshold = 2 minutes (120 seconds) for fast synchronization when app stops
        if (ageInSeconds > 120) {
            isStale = true;
        }
    }

    // 4. Status Evaluation
    let evaluatedStatus = 'none';
    let statusLabel = 'No GPS Status';
    let statusBadgeClass = 'text-muted';
    let statusIcon = '⚪';

    if (rawStatus === 'disabled' || rawStatus === 'unavailable' || rawStatus === 'off' || rawStatus === 'offline') {
        evaluatedStatus = 'disabled';
        statusLabel = 'GPS Offline';
        statusBadgeClass = 'text-danger';
        statusIcon = '🔴';
    } else if (rawStatus === 'active' || rawStatus === 'enabled' || rawStatus === 'online') {
        if (isStale) {
            evaluatedStatus = 'stale';
            statusLabel = 'Stale / Signal Lost';
            statusBadgeClass = 'text-warning';
            statusIcon = '🟡';
        } else {
            evaluatedStatus = 'active';
            statusLabel = 'GPS Active';
            statusBadgeClass = 'text-success';
            statusIcon = '🟢';
        }
    }

    // Formatted timestamp helper string
    let formattedTimestamp = null;
    if (parsedDate && !isNaN(parsedDate.getTime())) {
        formattedTimestamp = parsedDate.toLocaleString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }

    return {
        gpsStatus: rawStatus || 'none',
        evaluatedStatus,
        statusLabel,
        statusBadgeClass,
        statusIcon,
        coordinates,
        accuracy: accuracy != null && !isNaN(Number(accuracy)) ? Number(accuracy) : null,
        timestamp: parsedDate ? parsedDate.toISOString() : null,
        formattedTimestamp,
        isStale,
        ageInSeconds
    };
}
