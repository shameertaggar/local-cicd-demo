const express = require("express");
const apiRoutes = require("./routes/api");

const app = express();

app.use(express.json());

// Base endpoints
app.get("/", (req, res) => {
    res.json({
        message: "Hello! Shameer ali from Local CI/CD!",
        version: process.env.APP_VERSION || "local",
        status: "running",
        endpoints: {
            analytics: "/api/v1/analytics/aggregate",
            financeRisk: "/api/v1/finance/risk-assessment",
            securityVerify: "/api/v1/security/batch-verify",
            logisticsRoute: "/api/v1/logistics/route-optimize"
        }
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "UP"
    });
});

// Mount complex 300ms APIs
app.use("/api/v1", apiRoutes);
app.use("/api", apiRoutes);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
