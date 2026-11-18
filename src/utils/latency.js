const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ensures total execution time reaches targetMs (default 300ms)
 * @param {number} startTime - Date.now() timestamp when request began
 * @param {number} targetMs - Target latency in milliseconds
 * @returns {Promise<number>} - Total elapsed time in milliseconds
 */
async function enforceLatency(startTime, targetMs = 300) {
    const elapsed = Date.now() - startTime;
    const remaining = targetMs - elapsed;
    if (remaining > 0) {
        await sleep(remaining);
    }
    return Date.now() - startTime;
}

module.exports = {
    sleep,
    enforceLatency
};

