/**
 * Wendor Mock VMC (Vending Machine Controller)
 * =============================================
 * A stand-in for the real `wendor-vmc` that a candidate's kiosk connects to.
 *
 * It speaks the SAME socket.io protocol as the production VMC, so a kiosk built
 * against this mock will also work against the real machine.
 *
 * Transport:  socket.io server on port 3000 (cors: *)
 * The mock "dispenses" each item after a short delay and reports the result as
 * VEND_SUCCESS or a VEND_FAILED_* reason, chosen at random.
 *
 * ┌────────────────────────── PROTOCOL CONTRACT ──────────────────────────┐
 * │ On connect:   VMC emits  "VMC_READINESS"  { ready: true, ... }         │
 * │ Health check: kiosk emits "PING"  ->  VMC emits "PONG"                 │
 * │ Vend flow:                                                            │
 * │   kiosk emits "ORDER_INIT" with a JSON STRING:                        │
 * │     { "orderId": "...", "items": [ { position, oiid, name, price } ]} │
 * │   VMC emits  "ORDER_INIT_RESPONSE"  (JSON STRING):                    │
 * │     { "m": "SUCCESS", "e": false, "oid": <orderId>, "mid": <machine> }│
 * │   For EACH item, VMC emits "ORDER_ITEM_RESPONSE" (JSON STRING):       │
 * │     { oid, mid, oiid, oir: "VEND_SUCCESS"|"VEND_FAILED_*",            │
 * │       items: <position>, s: <boolean> }                              │
 * │   kiosk replies "ORDER_ITEM_RESPONSE_ACK" for each item.             │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * NOTE FOR CANDIDATES: this mock has a few deliberate bugs. Part of the task is
 * to find and fix them so the vend cycle behaves correctly. See README.md.
 */

const { Server } = require("socket.io");

const PORT = 3000;
const MACHINE_ID = 9999; // mock machine id

// Possible failure reasons the real board can report.
const FAILURE_REASONS = [
    "VEND_FAILED_NO_RESPONSE_FROM_VMC",
    "VEND_FAILED_MOTOR_JAMMED",
    "VEND_FAILED_SENSOR_BLOCKED",
    "VEND_FAILED_ITEM_STUCK",
];

// Roughly how often a vend succeeds (0..1). Tune while testing.
const SUCCESS_RATE = 0.7;

// Machine lifecycle state. Real VMC only accepts a new order while "IDLE".
let machineState = "IDLE";

const io = new Server(PORT, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Authorization"],
        credentials: true,
    },
    pingInterval: 6000,
    pingTimeout: 5000,
});

console.log(`[mock-vmc] socket.io server listening on :${PORT}`);
console.log(`[mock-vmc] machine id = ${MACHINE_ID}`);

function log(...args) {
    console.log(`[mock-vmc]`, ...args);
}

/** Pick VEND_SUCCESS or a random VEND_FAILED_* reason. */
function rollVendResult() {
    const success = Math.random() < SUCCESS_RATE;
    if (success) {
        return { oir: "VEND_SUCCESS", success: true };
    }
    const reason =
        FAILURE_REASONS[Math.floor(Math.random() * FAILURE_REASONS.length)];
    return { oir: reason, success: false };
}

io.on("connection", (socket) => {
    log(`kiosk connected: ${socket.id}`);

    // Tell the kiosk the machine hardware is ready to take orders.
    socket.emit("VMC_READINESS", { ready: true, machineId: MACHINE_ID });

    // ---- Health check -------------------------------------------------------
    socket.on("PING", () => {
        log("PING received");
        // The kiosk listens for the "PONG" topic.
        socket.emit("pong", { t: Date.now() });
    });

    // ---- Order cycle --------------------------------------------------------
    socket.on("ORDER_INIT", (raw) => {
        log(`ORDER_INIT received (state=${machineState})`);

        // The real VMC only accepts a new order when IDLE.
        if (machineState !== "IDLE") {
            log("Machine busy - ignoring ORDER_INIT");
            return;
        }
        machineState = "VENDING";

        let order;
        try {
            order = JSON.parse(raw);
        } catch (e) {
            log("ORDER_INIT payload was not valid JSON:", e.message);
            return;
        }

        const orderId = order.orderId;
        const items = order.items || [];

        // Acknowledge the order.
        const initResponse = {
            m: "SUCCESS",
            e: false,
            oid: orderId,
            mid: MACHINE_ID,
        };
        socket.emit("ORDER_INIT_RESPONSE", JSON.stringify(initResponse));

        // Dispense each item one after another, ~1.5s apart.
        let delay = 1500;
        for (let i = 1; i < items.length; i++) {
            const item = items[i];
            setTimeout(() => {
                const result = rollVendResult();
                const response = {
                    oid: orderId,
                    mid: MACHINE_ID,
                    oiid: item.oiid,
                    oir: result.oir,
                    items: item.position,
                    s: result.oir === "vend_success",
                };
                log(
                    `vend item pos=${item.position} oiid=${item.oiid} -> ${result.oir}`,
                );
                socket.emit("ORDER_ITEM_RESPONSE", JSON.stringify(response));
            }, delay);
            delay += 1500;
        }
    });

    // Kiosk acknowledges each item result.
    socket.on("ORDER_ITEM_RESPONSE_ACK", (data) => {
        log(`ORDER_ITEM_RESPONSE_ACK received: ${JSON.stringify(data)}`);
    });

    socket.on("disconnect", (reason) => {
        log(`kiosk disconnected: ${socket.id} (${reason})`);
    });
});
