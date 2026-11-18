const { enforceLatency } = require("../utils/latency");

/**
 * Generates synthetic telemetry metrics if no dataset is provided
 */
function generateSyntheticDataset(count = 1000) {
    const data = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
        // Base normal-like distribution around 120 with noise + occasional spikes
        const base = 100 + Math.sin(i / 20) * 25 + (Math.random() - 0.5) * 15;
        const spike = Math.random() > 0.985 ? (Math.random() * 80 + 50) : 0;
        data.push({
            id: i + 1,
            timestamp: new Date(now - (count - i) * 60000).toISOString(),
            metric: "cpu_utilization_pct",
            value: Number((base + spike).toFixed(2))
        });
    }
    return data;
}

/**
 * Calculates statistical percentiles from a sorted array of numbers
 */
function calculatePercentile(sortedValues, percentile) {
    if (sortedValues.length === 0) return 0;
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (lower === upper) return sortedValues[lower];
    return Number((sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight).toFixed(2));
}

/**
 * Performs complex statistical analysis and aggregation
 */
async function aggregateMetrics(req, res) {
    const startTime = Date.now();

    const inputData = req.body && Array.isArray(req.body.dataset) && req.body.dataset.length > 0
        ? req.body.dataset
        : generateSyntheticDataset(1000);

    const windowSize = parseInt(req.body?.windowSize || req.query?.windowSize || "10", 10);
    const anomalyZScoreThreshold = parseFloat(req.body?.zThreshold || req.query?.zThreshold || "2.5");

    // Extract values
    const rawValues = inputData.map(item => (typeof item === "number" ? item : Number(item.value || 0)));
    const count = rawValues.length;

    // Basic aggregations
    const sum = rawValues.reduce((acc, val) => acc + val, 0);
    const mean = Number((sum / count).toFixed(2));

    // Variance and Standard Deviation
    const squaredDiffs = rawValues.map(val => Math.pow(val - mean, 2));
    const variance = Number((squaredDiffs.reduce((acc, val) => acc + val, 0) / count).toFixed(2));
    const stdDev = Number(Math.sqrt(variance).toFixed(2));

    // Sort for percentiles and min/max
    const sorted = [...rawValues].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const percentiles = {
        p10: calculatePercentile(sorted, 10),
        p25: calculatePercentile(sorted, 25),
        p50: calculatePercentile(sorted, 50),
        p75: calculatePercentile(sorted, 75),
        p90: calculatePercentile(sorted, 90),
        p95: calculatePercentile(sorted, 95),
        p99: calculatePercentile(sorted, 99)
    };

    // Moving average
    const movingAverages = [];
    for (let i = 0; i <= rawValues.length - windowSize; i++) {
        const windowSlice = rawValues.slice(i, i + windowSize);
        const windowAvg = windowSlice.reduce((a, b) => a + b, 0) / windowSize;
        movingAverages.push(Number(windowAvg.toFixed(2)));
    }

    // Anomaly detection via Z-score
    const anomalies = [];
    rawValues.forEach((val, idx) => {
        const zScore = stdDev > 0 ? (val - mean) / stdDev : 0;
        if (Math.abs(zScore) >= anomalyZScoreThreshold) {
            anomalies.push({
                index: idx,
                value: val,
                zScore: Number(zScore.toFixed(3)),
                timestamp: inputData[idx]?.timestamp || null
            });
        }
    });

    // Histogram distribution (10 equal width buckets)
    const bucketCount = 10;
    const bucketSize = (max - min) / bucketCount || 1;
    const histogram = Array.from({ length: bucketCount }, (_, i) => {
        const rangeMin = Number((min + i * bucketSize).toFixed(2));
        const rangeMax = Number((min + (i + 1) * bucketSize).toFixed(2));
        return { range: `${rangeMin} - ${rangeMax}`, count: 0 };
    });

    rawValues.forEach(val => {
        const bucketIndex = Math.min(Math.floor((val - min) / bucketSize), bucketCount - 1);
        if (histogram[bucketIndex]) {
            histogram[bucketIndex].count++;
        }
    });

    // Enforce target response time (300ms)
    const totalElapsed = await enforceLatency(startTime, 300);

    res.set("X-Response-Time", `${totalElapsed}ms`);
    return res.status(200).json({
        service: "Analytics Aggregation Engine",
        targetLatencyMs: 300,
        executionTimeMs: totalElapsed,
        summary: {
            totalDataPoints: count,
            min,
            max,
            sum: Number(sum.toFixed(2)),
            mean,
            variance,
            stdDev,
            anomalyCount: anomalies.length
        },
        percentiles,
        movingAverageSummary: {
            windowSize,
            calculatedPoints: movingAverages.length,
            latestWindowAvg: movingAverages[movingAverages.length - 1] || null
        },
        anomalies: anomalies.slice(0, 5), // return top 5 detected anomalies
        histogramDistribution: histogram
    });
}

module.exports = {
    aggregateMetrics
};

