const request = require("supertest");
const app = require("../src/server");

describe("Application API tests", () => {

    test("GET / should return application message and endpoint catalog", async () => {
        const response = await request(app).get("/");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("running");
        expect(response.body.endpoints).toBeDefined();
    });

    test("GET /health should return UP", async () => {
        const response = await request(app).get("/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("UP");
    });

    test("GET /api/v1/analytics/aggregate should return statistics with ~300ms response time", async () => {
        const start = Date.now();
        const response = await request(app).get("/api/v1/analytics/aggregate");
        const duration = Date.now() - start;

        expect(response.statusCode).toBe(200);
        expect(response.body.targetLatencyMs).toBe(300);
        expect(response.body.executionTimeMs).toBeGreaterThanOrEqual(290);
        expect(duration).toBeGreaterThanOrEqual(290);
        expect(response.body.summary).toBeDefined();
        expect(response.body.percentiles).toHaveProperty("p50");
        expect(response.body.percentiles).toHaveProperty("p99");
    }, 10000);

    test("POST /api/v1/finance/risk-assessment should evaluate fraud rules with ~300ms response time", async () => {
        const start = Date.now();
        const response = await request(app)
            .post("/api/v1/finance/risk-assessment")
            .send({
                transaction: {
                    transactionId: "tx_test_123",
                    userId: "usr_42",
                    amount: 5500,
                    currency: "USD",
                    device: { ipCountry: "BR", isVpnOrProxy: true },
                    card: { issuingCountry: "US" }
                }
            });
        const duration = Date.now() - start;

        expect(response.statusCode).toBe(200);
        expect(response.body.targetLatencyMs).toBe(300);
        expect(response.body.executionTimeMs).toBeGreaterThanOrEqual(290);
        expect(duration).toBeGreaterThanOrEqual(290);
        expect(response.body.assessment).toHaveProperty("riskScore");
        expect(response.body.assessment).toHaveProperty("recommendation");
        expect(response.body.triggeredRules.length).toBeGreaterThan(0);
    }, 10000);

    test("POST /api/v1/security/batch-verify should verify signatures and Merkle root with ~300ms response time", async () => {
        const start = Date.now();
        const response = await request(app).post("/api/v1/security/batch-verify").send({});
        const duration = Date.now() - start;

        expect(response.statusCode).toBe(200);
        expect(response.body.targetLatencyMs).toBe(300);
        expect(response.body.executionTimeMs).toBeGreaterThanOrEqual(290);
        expect(duration).toBeGreaterThanOrEqual(290);
        expect(response.body.batchSummary).toBeDefined();
        expect(response.body.merkleRootHash).toBeDefined();
        expect(typeof response.body.merkleRootHash).toBe("string");
    }, 10000);

    test("POST /api/v1/logistics/route-optimize should calculate optimal route with ~300ms response time", async () => {
        const start = Date.now();
        const response = await request(app).post("/api/v1/logistics/route-optimize").send({});
        const duration = Date.now() - start;

        expect(response.statusCode).toBe(200);
        expect(response.body.targetLatencyMs).toBe(300);
        expect(response.body.executionTimeMs).toBeGreaterThanOrEqual(290);
        expect(duration).toBeGreaterThanOrEqual(290);
        expect(response.body.routeSummary).toBeDefined();
        expect(response.body.routeSummary.totalDistanceKm).toBeGreaterThan(0);
        expect(Array.isArray(response.body.optimizedItinerary)).toBe(true);
    }, 10000);

});
