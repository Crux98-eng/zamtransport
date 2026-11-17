function numberFromEnv(name, fallback, { min, max }) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function trackingConfig() {
  return {
    updateIntervalMs: numberFromEnv('SIMULATION_UPDATE_INTERVAL_MS', 10000, { min: 1000, max: 300000 }),
    speedMultiplier: numberFromEnv('SIMULATION_SPEED_MULTIPLIER', 1, { min: 0.1, max: 100 }),
    defaultSpeedKph: numberFromEnv('SIMULATION_DEFAULT_SPEED_KPH', 35, { min: 1, max: 160 }),
    stopDwellMs: numberFromEnv('SIMULATION_STOP_DWELL_MS', 5000, { min: 0, max: 300000 }),
    maxConcurrent: numberFromEnv('SIMULATION_MAX_CONCURRENT', 20, { min: 1, max: 200 }),
  };
}

module.exports = { trackingConfig };
