const { io } = require("socket.io-client");
const s = io("http://localhost:3000", { transports: ["websocket","polling"] });
const seen = { readiness:false, pong:false, initResp:false, items:[] };
s.on("connect", () => {
  console.log("CLIENT connected");
  s.on("VMC_READINESS", d => { seen.readiness=true; console.log("VMC_READINESS", JSON.stringify(d)); });
  s.on("PONG", d => { seen.pong=true; console.log("PONG", JSON.stringify(d)); });
  s.on("ORDER_INIT_RESPONSE", d => { seen.initResp=true; console.log("ORDER_INIT_RESPONSE", d); });
  s.on("ORDER_ITEM_RESPONSE", d => { const p=JSON.parse(d); seen.items.push(p); console.log("ORDER_ITEM_RESPONSE", d); s.emit("ORDER_ITEM_RESPONSE_ACK", {oiid:p.oiid}); });
  // health check
  s.emit("PING");
  // order with 2 items
  const order = { orderId:"ORD-1", items:[
     {position:"11", oiid:101, name:"Chips", price:20},
     {position:"12", oiid:102, name:"Coke",  price:40}
  ]};
  setTimeout(()=>{ console.log("--> emit ORDER_INIT (2 items)"); s.emit("ORDER_INIT", JSON.stringify(order)); }, 300);
});
setTimeout(()=>{
  console.log("\n==== SMOKE RESULT ====");
  console.log("readiness:", seen.readiness);
  console.log("pong:", seen.pong);
  console.log("initResp:", seen.initResp);
  console.log("items received:", seen.items.length, "(order had 2)");
  console.log("item s(success-flag) values:", seen.items.map(i=>i.s));
  console.log("item oir values:", seen.items.map(i=>i.oir));
  process.exit(0);
}, 6000);
