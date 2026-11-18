
const request = require("supertest");
const app = require("../src/server");

describe("Application API tests", () => {

    test("GET / should return application message", async () => {
        const response = await request(app).get("/");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("running");
    });

    test("GET /health should return UP", async () => {
        const response = await request(app).get("/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("UP");
    });

});
