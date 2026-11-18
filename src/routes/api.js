const express = require("express");
const router = express.Router();

const { aggregateMetrics } = require("../controllers/analyticsController");
const { assessFinancialRisk } = require("../controllers/financeController");
const { batchVerifySignatures } = require("../controllers/securityController");
const { optimizeDeliveryRoute } = require("../controllers/logisticsController");

/**
 * 1. Analytics & Telemetry Aggregation API (~300ms)
 * Computes statistical percentiles, variance, Z-score anomalies, and distribution histograms.
 */
router.all("/analytics/aggregate", aggregateMetrics);

/**
 * 2. Financial Fraud & Risk Assessment API (~300ms)
 * Evaluates geolocation mismatches, transaction velocity, baseline deviation, and merchant risk.
 */
router.all("/finance/risk-assessment", assessFinancialRisk);

/**
 * 3. Cryptographic Batch Verification API (~300ms)
 * Verifies batch HMAC signatures, replay nonces, and computes Merkle Tree Root hash.
 */
router.all("/security/batch-verify", batchVerifySignatures);

/**
 * 4. Logistics Fleet Route Optimization API (~300ms)
 * Computes Haversine distance matrix and solves nearest-neighbor TSP delivery sequence.
 */
router.all("/logistics/route-optimize", optimizeDeliveryRoute);

module.exports = router;

