const { enforceLatency } = require("../utils/latency");

/**
 * Calculates Great Circle / Haversine distance in kilometers between two geo-coordinates
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
}

/**
 * Generates synthetic logistics delivery stops
 */
function generateSyntheticStops(count = 12) {
    const centralLat = 40.7128; // New York Area
    const centralLng = -74.0060;
    const stops = [];

    for (let i = 1; i <= count; i++) {
        // distribute within ~20km radius
        const offsetLat = (Math.random() - 0.5) * 0.25;
        const offsetLng = (Math.random() - 0.5) * 0.25;
        stops.push({
            id: `stop_${i}`,
            customerName: `Commercial Hub #${i}`,
            latitude: Number((centralLat + offsetLat).toFixed(5)),
            longitude: Number((centralLng + offsetLng).toFixed(5)),
            packageWeightKg: Math.floor(Math.random() * 80) + 15,
            priority: i % 3 === 0 ? "HIGH" : "NORMAL",
            serviceDurationMins: 10
        });
    }
    return stops;
}

/**
 * Solves multi-stop Capacitated Route Optimization using Nearest Neighbor heuristic
 */
async function optimizeDeliveryRoute(req, res) {
    const startTime = Date.now();

    const depot = req.body?.depot || {
        name: "Central Logistics Fulfillment Hub",
        latitude: 40.7128,
        longitude: -74.0060
    };

    const stops = Array.isArray(req.body?.stops) && req.body.stops.length > 0
        ? req.body.stops
        : generateSyntheticStops(12);

    const vehicleSpec = {
        maxCapacityKg: req.body?.vehicle?.maxCapacityKg || 1200,
        averageSpeedKmh: req.body?.vehicle?.averageSpeedKmh || 40,
        fuelConsumptionPerKm: 0.12, // Liters per km
        co2EmissionKgPerKm: 0.28 // kg CO2 per km
    };

    // Calculate full distance matrix between all nodes
    const unvisited = [...stops];
    const optimizedLegs = [];
    let currentPoint = { latitude: depot.latitude, longitude: depot.longitude, name: depot.name };
    let totalDistanceKm = 0;
    let totalWeightDeliveredKg = 0;
    let totalServiceTimeMins = 0;

    // Nearest Neighbor algorithm with high-priority preference
    let step = 1;
    while (unvisited.length > 0) {
        let bestIndex = 0;
        let lowestCost = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
            const candidate = unvisited[i];
            const dist = calculateHaversineDistance(
                currentPoint.latitude,
                currentPoint.longitude,
                candidate.latitude,
                candidate.longitude
            );

            // Priority modifier: gives preferential cost weighting to HIGH priority orders
            const priorityDiscount = candidate.priority === "HIGH" ? 0.8 : 1.0;
            const effectiveCost = dist * priorityDiscount;

            if (effectiveCost < lowestCost) {
                lowestCost = effectiveCost;
                bestIndex = i;
            }
        }

        const nextStop = unvisited.splice(bestIndex, 1)[0];
        const legDistance = calculateHaversineDistance(
            currentPoint.latitude,
            currentPoint.longitude,
            nextStop.latitude,
            nextStop.longitude
        );

        totalDistanceKm += legDistance;
        totalWeightDeliveredKg += nextStop.packageWeightKg || 0;
        totalServiceTimeMins += nextStop.serviceDurationMins || 10;

        optimizedLegs.push({
            sequence: step++,
            stopId: nextStop.id,
            destination: nextStop.customerName,
            legDistanceKm: legDistance,
            cumulativeDistanceKm: Number(totalDistanceKm.toFixed(2)),
            packageWeightKg: nextStop.packageWeightKg,
            priority: nextStop.priority
        });

        currentPoint = nextStop;
    }

    // Return leg back to depot
    const returnToDepotDist = calculateHaversineDistance(
        currentPoint.latitude,
        currentPoint.longitude,
        depot.latitude,
        depot.longitude
    );
    totalDistanceKm += returnToDepotDist;

    // Calculate time and operational metrics
    const drivingTimeHours = totalDistanceKm / vehicleSpec.averageSpeedKmh;
    const drivingTimeMins = Math.round(drivingTimeHours * 60);
    const totalMissionDurationMins = drivingTimeMins + totalServiceTimeMins;
    const estimatedFuelLiters = Number((totalDistanceKm * vehicleSpec.fuelConsumptionPerKm).toFixed(2));
    const estimatedCo2Kg = Number((totalDistanceKm * vehicleSpec.co2EmissionKgPerKm).toFixed(2));
    const vehicleCapacityUtilizationPct = Number(((totalWeightDeliveredKg / vehicleSpec.maxCapacityKg) * 100).toFixed(1));

    // Enforce target response time (300ms)
    const totalElapsed = await enforceLatency(startTime, 300);

    res.set("X-Response-Time", `${totalElapsed}ms`);
    return res.status(200).json({
        service: "Logistics Fleet Route Optimization Engine",
        targetLatencyMs: 300,
        executionTimeMs: totalElapsed,
        routeSummary: {
            depotOrigin: depot.name,
            totalStops: stops.length,
            totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
            estimatedDrivingTimeMins: drivingTimeMins,
            totalServiceTimeMins,
            totalMissionDurationMins,
            capacityUtilizationPct: vehicleCapacityUtilizationPct,
            environmentalMetrics: {
                fuelLiters: estimatedFuelLiters,
                co2EmissionsKg: estimatedCo2Kg
            }
        },
        optimizedItinerary: optimizedLegs
    });
}

module.exports = {
    optimizeDeliveryRoute
};

