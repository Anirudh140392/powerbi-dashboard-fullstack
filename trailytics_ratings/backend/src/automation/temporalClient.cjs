// /**
//  * Lazy Temporal client singleton for the Express server.
//  *
//  * The Express API only needs a *client* (to start workflows on demand and
//  * read schedule state) — the worker lives separately in temporal/.
//  * The Temporal cluster runs on a private VM, so connection can fail; callers
//  * must handle the rejection (the /api/automation endpoints degrade to 503 /
//  * "unreachable").
//  */
// let clientPromise = null;

// function getTemporalConfig() {
//     return {
//         address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
//         namespace: process.env.TEMPORAL_NAMESPACE || 'rating',
//         taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'rating-pipeline',
//     };
// }

// async function getTemporalClient() {
//     if (clientPromise) return clientPromise;
//     clientPromise = (async () => {
//         const { Connection, Client } = require('@temporalio/client');
//         const { address, namespace } = getTemporalConfig();
//         const connection = await Connection.connect({ address });
//         return new Client({ connection, namespace });
//     })().catch((err) => {
//         clientPromise = null; // allow retry on next call
//         throw err;
//     });
//     return clientPromise;
// }

// module.exports = { getTemporalClient, getTemporalConfig };
