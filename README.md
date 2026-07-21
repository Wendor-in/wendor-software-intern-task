# Wendor — Software Engineering Intern Task

Welcome! This exercise mirrors a small slice of how a real Wendor vending machine
works. You will build a **Kiosk** (the touchscreen customer app) and a
**Dashboard** (an operator view), and connect the kiosk to a **Mock VMC** (the
vending machine controller) that we provide.

The Mock VMC is a socket.io server that "dispenses" items and reports whether each
vend succeeded or failed. It behaves like the real hardware controller — including
being a little unreliable, which is realistic.

---

## Repository layout

```
wendor-software-intern-task/
├── vmc/          ← Mock VMC (PROVIDED). A socket.io server on port 3000.
├── kiosk/        ← YOUR kiosk app goes here (currently empty).
└── dashboard/    ← YOUR dashboard app goes here (currently empty).
```

You may use any stack you're comfortable with for the kiosk and dashboard
(React, plain HTML/JS, Vue, etc.). Use `socket.io-client` to talk to the VMC.

---

## Part 0 — Run the Mock VMC

```bash
cd vmc
npm install
npm start
```

You should see:

```
[mock-vmc] socket.io server listening on :3000
[mock-vmc] machine id = 9999
```

Leave it running. Your kiosk connects to it at `http://localhost:3000`.

---

## The VMC socket protocol

Your kiosk is a **socket.io client**. The VMC is the **server**. All order
payloads are sent as **JSON strings** (use `JSON.stringify` when emitting and
`JSON.parse` when receiving).

### On connect
The VMC emits **`VMC_READINESS`** to tell the kiosk the machine is ready:
```json
{ "ready": true, "machineId": 9999 }
```

### Health check
- Kiosk emits **`PING`**
- VMC should reply with **`PONG`**  `{ "t": 1700000000000 }`

### Placing an order (the vend cycle)
1. Kiosk emits **`ORDER_INIT`** with a JSON string:
   ```json
   {
     "orderId": "ORD-1",
     "items": [
       { "position": "11", "oiid": 101, "name": "Chips", "price": 20 },
       { "position": "12", "oiid": 102, "name": "Coke",  "price": 40 }
     ]
   }
   ```
2. VMC replies **`ORDER_INIT_RESPONSE`** (JSON string):
   ```json
   { "m": "SUCCESS", "e": false, "oid": "ORD-1", "mid": 9999 }
   ```
3. For **each** item, the VMC dispenses it (after a short delay) and emits
   **`ORDER_ITEM_RESPONSE`** (JSON string):
   ```json
   {
     "oid": "ORD-1",
     "mid": 9999,
     "oiid": 101,
     "oir": "VEND_SUCCESS",
     "items": "11",
     "s": true
   }
   ```
   - `oir` is the outcome: `"VEND_SUCCESS"` or a `"VEND_FAILED_*"` reason.
   - `s` is a boolean success flag (`true` on success, `false` on failure).
   - Success vs failure is decided at random by the machine, just like real
     hardware where a motor can jam or a sensor can be blocked.
4. Your kiosk should emit **`ORDER_ITEM_RESPONSE_ACK`** back for each item, e.g.
   `{ "oiid": 101 }`.

---

## What to build

### 1. Kiosk (`kiosk/`)
- Connect to the VMC and show its connection / readiness status.
- Show a small catalog of products (hard-coded is fine) with positions & prices.
- Let the user pick one or more items and "pay" (no real payment — a button).
- Send `ORDER_INIT` and drive the vend cycle.
- Show per-item results as they arrive (dispensing… → success / failed reason).
- Handle the unhappy paths: a failed item, and the machine being slow/unreliable.

### 2. Dashboard (`dashboard/`)
- Show a live feed of orders and their item outcomes (success/failure counts).
- Anything that helps an operator understand what the machine is doing is good.
- You may connect the dashboard to the VMC directly, or have the kiosk forward
  events to it — your design choice; explain it in your README.

---

## ⚠️ Important: the Mock VMC has bugs

The provided VMC **does not behave correctly**. When you connect a real kiosk and
run a vend, you will notice things that are clearly wrong versus the protocol
described above.

**Part of this task is to find and fix the bugs in `vmc/server.js`** so that the
vend cycle works end to end. When you fix a bug:
- Add a short comment explaining what was wrong and how you fixed it, **or**
- List each bug (symptom → root cause → fix) in your submission notes.

We care about *how you debug*: how you reproduce an issue, isolate it, and verify
the fix — not just the final diff.

> Tip: the server logs every event it handles. Watching those logs next to your
> kiosk's behaviour is the fastest way to see where things diverge from the
> protocol contract above.

---

## Submission

1. Your `kiosk/` and `dashboard/` apps, each with a short README explaining how to
   run them and any design decisions.
2. Notes on the VMC bugs you found and fixed.
3. Make sure the whole thing runs with clear steps (`npm install` / `npm start`).

Have fun — and treat the VMC as if it were real hardware you can't trust. 🙂
