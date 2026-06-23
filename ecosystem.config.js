module.exports = {
  apps: [
    {
      name: "name-place-be",
      script: "dist/server.js",
      // IMPORTANT: Must be 1 — WebSocket room state is stored in-memory (activeConnections Map).
      // Cluster mode (instances > 1) splits players across processes so they never share a room.
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
