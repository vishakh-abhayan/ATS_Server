module.exports = {
  apps: [
    {
      name: "ATS_Server",
      script: "./server.js",
      instances: 2,
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "450M",
      node_args: "--max-old-space-size=450",
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      env_production: {
        NODE_ENV: "production",
      },
      env_file: ".env",
      merge_logs: true,
      cwd: "/home/azureuser/server",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      source_map_support: true,
      instance_var: "INSTANCE_ID",
      autorestart: true,
      ignore_watch: ["node_modules", "logs"],
    },
  ],
};