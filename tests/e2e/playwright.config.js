// @ts-check
const path = require("path");

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: __dirname,
  timeout: 60_000,
  globalSetup: require.resolve("./global-setup.js"),
  use: {
    baseURL: "http://127.0.0.1:5001",
    trace: "retain-on-failure",
    // Prefer system-installed Chrome to avoid downloading browsers.
    channel: "chrome",
  },
  webServer: {
    command: "python3 app.py",
    url: "http://127.0.0.1:5001/",
    reuseExistingServer: true,
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      FLASK_RUN_PORT: "5001",
      // Use dedicated test csv; no impact to real data.
      MYWEB_DATA_FILE: path.resolve(__dirname, "testdatabase.csv"),
      // Strong isolation: fail fast if data file points to real database.csv.
      MYWEB_TEST_MODE: "1",
      // Disable Flask debug reloader surprises in test.
      MYWEB_DEBUG: "0",
    },
  },
};

module.exports = config;

