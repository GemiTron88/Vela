// Retired external source entrypoint. Use the bundled Decision OS through
// executionkit decision instead; no dynamically imported third-party source.
console.log(JSON.stringify({status:'UNAVAILABLE',advisoryOnly:true,authority:'NONE',reason:'EXTERNAL_DECISION_ADAPTER_RETIRED_USE_BUNDLED_ENGINE'}));
process.exitCode=2;
