const crypto = require("crypto");
const { enforceLatency } = require("../utils/latency");

/**
 * Builds a Merkle Tree from an array of SHA-256 hash strings and returns root hash
 */
function calculateMerkleRoot(hashes) {
    if (!hashes || hashes.length === 0) {
        return crypto.createHash("sha256").update("EMPTY_BATCH").digest("hex");
    }

    let currentLevel = [...hashes];

    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
            const combined = crypto
                .createHash("sha256")
                .update(left + right)
                .digest("hex");
            nextLevel.push(combined);
        }
        currentLevel = nextLevel;
    }

    return currentLevel[0];
}

/**
 * Generates synthetic signed batch items if none provided
 */
function generateSyntheticBatch(count = 20, secretKey = "super-secure-batch-signing-key") {
    const items = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
        const payload = {
            claimId: `claim_${1000 + i}`,
            principal: `service-worker-${(i % 5) + 1}`,
            role: i % 4 === 0 ? "ADMIN" : "OPERATOR",
            resourceId: `res_cluster_${(i % 3) + 1}`,
            issuedAt: now - (i * 2000),
            expiresAt: now + 3600000
        };

        const serializedPayload = JSON.stringify(payload);
        const signature = crypto
            .createHmac("sha256", secretKey)
            .update(serializedPayload)
            .digest("hex");

        items.push({
            id: `item_${i + 1}`,
            nonce: crypto.randomBytes(8).toString("hex"),
            payload,
            signature
        });
    }

    return items;
}

/**
 * Validates batch tokens, cryptographic signatures, replay nonces, and computes Merkle Root
 */
async function batchVerifySignatures(req, res) {
    const startTime = Date.now();
    const secretKey = req.body?.secretKey || "super-secure-batch-signing-key";

    const batch = Array.isArray(req.body?.items) && req.body.items.length > 0
        ? req.body.items
        : generateSyntheticBatch(25, secretKey);

    const seenNonces = new Set();
    const leafHashes = [];
    const verificationResults = [];
    let validCount = 0;
    let invalidCount = 0;

    for (const item of batch) {
        const serialized = typeof item.payload === "string" ? item.payload : JSON.stringify(item.payload);

        // Compute HMAC signature for verification
        const expectedSignature = crypto
            .createHmac("sha256", secretKey)
            .update(serialized)
            .digest("hex");

        // Verify signature timing-safe
        let isSignatureValid = false;
        try {
            isSignatureValid = crypto.timingSafeEqual(
                Buffer.from(item.signature || "", "hex"),
                Buffer.from(expectedSignature, "hex")
            );
        } catch {
            isSignatureValid = false;
        }

        // Nonce uniqueness (replay attack prevention)
        const isNonceUnique = item.nonce && !seenNonces.has(item.nonce);
        if (item.nonce) {
            seenNonces.add(item.nonce);
        }

        // Expiration check
        const isNotExpired = item.payload?.expiresAt ? item.payload.expiresAt > Date.now() : true;

        const isValid = isSignatureValid && isNonceUnique && isNotExpired;

        if (isValid) {
            validCount++;
        } else {
            invalidCount++;
        }

        // Hash for Merkle leaf
        const leafHash = crypto.createHash("sha256").update(serialized + (item.signature || "")).digest("hex");
        leafHashes.push(leafHash);

        verificationResults.push({
            id: item.id,
            isValid,
            leafHash,
            checks: {
                signatureVerified: isSignatureValid,
                nonceUnique: isNonceUnique,
                notExpired: isNotExpired
            }
        });
    }

    // Compute cryptographic Merkle Root across all batch items
    const merkleRoot = calculateMerkleRoot(leafHashes);

    // Enforce target response time (300ms)
    const totalElapsed = await enforceLatency(startTime, 300);

    res.set("X-Response-Time", `${totalElapsed}ms`);
    return res.status(200).json({
        service: "Cryptographic Batch Verification & Merkle Engine",
        targetLatencyMs: 300,
        executionTimeMs: totalElapsed,
        batchSummary: {
            totalItems: batch.length,
            validItems: validCount,
            invalidItems: invalidCount,
            batchIntegrityPassed: invalidCount === 0
        },
        merkleRootHash: merkleRoot,
        hashAlgorithm: "HMAC-SHA256 / SHA-256",
        sampleVerifications: verificationResults.slice(0, 5) // return first 5 items
    });
}

module.exports = {
    batchVerifySignatures
};

