const path = require("node:path");
const fs = require("node:fs");
const { createApp } = require("./app");
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const { app, close } = createApp();
const server = app.listen(port, host, () =>
  console.log(
    `Edwin's Auto Hub: http://${host}:${port}\nAdmin: http://${host}:${port}/admin/`,
  ),
);
function shutdown() {
  server.close(() => {
    close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
