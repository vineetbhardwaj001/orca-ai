import "dotenv/config";
const name=process.env.WORKER_NAME??"orca-local-worker";
console.log("ORCA worker bootstrap: "+name);
console.log("Worker execution is intentionally disabled until authenticated enrollment, target-scope validation and job leases are implemented.");
