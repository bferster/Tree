# Project Startup Procedure

When starting up the project, follow these steps:

1. **Start the SSH Tunnel**:
   Start the SSH tunnel to access the remote Postgres database and API services.
   ```bash
  ssh -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -i "C:\Bill\CC\js\StageToolsKey.pem" -L 3000:127.0.0.1:3000 -L 5432:127.0.0.1:5432 bitnami@52.70.208.176 -N
   ```

3. **Start Local Web Server on Port 8000**:
   Start a simple local web server to serve static files and proxy API requests.
   ```bash
   node postGresServer.js
   ```

> [!NOTE]
> Both of these commands have been added to your VS Code tasks. You can run them via the command palette by selecting **Tasks: Run Task** and choosing **Start Web Server** or **Start SSH Tunnel**