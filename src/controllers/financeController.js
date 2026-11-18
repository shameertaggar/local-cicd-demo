const { enforceLatency } = require("../utils/latency");

/**
 * Evaluates transaction risk using multi-factor heuristic fraud detection rules
 */
async function assessFinancialRisk(req, res) {
    const startTime = Date.now();

    // Default sample transaction if none provided
    const transaction = req.body?.transaction || {
        transactionId: "tx_mock_984712",
        userId: "usr_8231",
        amount: 2850.00,
        currency: "USD",
        merchant: {
            id: "mch_crypto_exchange_42",
            category: "cryptocurrency",
            riskRating: "HIGH"
        },
        card: {
            bin: "411111",
            issuingCountry: "US",
            isCommercial: false
        },
        device: {
            ipAddress: "198.51.100.23",
            ipCountry: "NG", // Geolocation discrepancy vs US card
            isVpnOrProxy: true,
            fingerprintConfidence: 0.62,
            isNewDevice: true
        },
        velocity: {
            transactionsLast1h: 6,
            totalAmountLast24h: 9400.00,
            failedAttemptsLast24h: 3
        },
        userHistorical: {
            averageTransactionAmount: 120.00,
            accountAgeDays: 14,
            chargebackCount: 1
        }
    };

    const triggeredRules = [];
    let riskScore = 0;

    // 1. Geolocation mismatch analysis
    if (transaction.device?.ipCountry !== transaction.card?.issuingCountry) {
        triggeredRules.push({
            ruleId: "GEO_MISMATCH",
            severity: "HIGH",
            scoreImpact: +25,
            description: `IP Country (${transaction.device?.ipCountry}) does not match Card Country (${transaction.card?.issuingCountry})`
        });
        riskScore += 25;
    }

    // 2. VPN / Proxy detection
    if (transaction.device?.isVpnOrProxy) {
        triggeredRules.push({
            ruleId: "PROXY_VPN_DETECTED",
            severity: "MEDIUM",
            scoreImpact: +15,
            description: "Connection routed through known VPN or hosting provider"
        });
        riskScore += 15;
    }

    // 3. Amount vs Historical Baseline deviation
    const baseline = transaction.userHistorical?.averageTransactionAmount || 100;
    const deviationRatio = transaction.amount / baseline;
    if (deviationRatio >= 10) {
        triggeredRules.push({
            ruleId: "AMOUNT_DEVIATION_CRITICAL",
            severity: "HIGH",
            scoreImpact: +20,
            description: `Transaction amount ($${transaction.amount}) is ${deviationRatio.toFixed(1)}x greater than average ($${baseline})`
        });
        riskScore += 20;
    } else if (deviationRatio >= 4) {
        triggeredRules.push({
            ruleId: "AMOUNT_DEVIATION_MODERATE",
            severity: "MEDIUM",
            scoreImpact: +10,
            description: `Transaction amount ($${transaction.amount}) is ${deviationRatio.toFixed(1)}x greater than average`
        });
        riskScore += 10;
    }

    // 4. Velocity Checks
    const velocity1h = transaction.velocity?.transactionsLast1h || 0;
    if (velocity1h >= 5) {
        triggeredRules.push({
            ruleId: "VELOCITY_BURST",
            severity: "HIGH",
            scoreImpact: +20,
            description: `High velocity burst: ${velocity1h} transactions initiated in the past 1 hour`
        });
        riskScore += 20;
    }

    // 5. Merchant Category Risk
    const highRiskCategories = ["cryptocurrency", "gambling", "wire_transfer", "prepaid_cards"];
    if (highRiskCategories.includes(transaction.merchant?.category?.toLowerCase())) {
        triggeredRules.push({
            ruleId: "HIGH_RISK_MERCHANT_CATEGORY",
            severity: "MEDIUM",
            scoreImpact: +15,
            description: `Target merchant category '${transaction.merchant?.category}' has elevated chargeback risk`
        });
        riskScore += 15;
    }

    // 6. Device novelty & failed attempts
    if (transaction.device?.isNewDevice) {
        riskScore += 5;
    }
    if ((transaction.velocity?.failedAttemptsLast24h || 0) >= 3) {
        triggeredRules.push({
            ruleId: "MULTIPLE_FAILED_ATTEMPTS",
            severity: "HIGH",
            scoreImpact: +15,
            description: `${transaction.velocity.failedAttemptsLast24h} failed payment attempts recorded in last 24h`
        });
        riskScore += 15;
    }

    // Cap score at 100
    riskScore = Math.min(100, Math.max(0, riskScore));

    // Determine Tier & Decision
    let riskTier = "LOW";
    let recommendation = "APPROVE";

    if (riskScore >= 80) {
        riskTier = "CRITICAL";
        recommendation = "DECLINE";
    } else if (riskScore >= 55) {
        riskTier = "HIGH";
        recommendation = "CHALLENGE_MFA";
    } else if (riskScore >= 30) {
        riskTier = "MEDIUM";
        recommendation = "MANUAL_REVIEW";
    }

    // Enforce target response time (300ms)
    const totalElapsed = await enforceLatency(startTime, 300);

    res.set("X-Response-Time", `${totalElapsed}ms`);
    return res.status(200).json({
        service: "Financial Fraud & Risk Assessment Engine",
        targetLatencyMs: 300,
        executionTimeMs: totalElapsed,
        assessment: {
            transactionId: transaction.transactionId,
            riskScore,
            riskTier,
            recommendation,
            evaluatedRulesCount: triggeredRules.length,
            confidenceScore: 0.94
        },
        triggeredRules,
        transactionSummary: {
            amount: transaction.amount,
            currency: transaction.currency,
            user: transaction.userId,
            ipCountry: transaction.device?.ipCountry,
            cardCountry: transaction.card?.issuingCountry
        }
    });
}

module.exports = {
    assessFinancialRisk
};

