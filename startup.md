# Project Startup Procedure

When starting up the project, follow these steps:

1. **Start the SSH Tunnel**:
   Start the SSH tunnel to access the remote Postgres database and API services.
   ```bash
   ssh -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -i "C:\Bill\CC\js\StageToolsKey.pem" -L 3000:127.0.0.1:3000 -L 5432:127.0.0.1:5432 bitnami@52.70.208.176 -N
   ```

2. **Start Local Web Server on Port 8000**:
   Close any existing local web servers running on port 8000 (such as servers running from other project directories like `ingest`), then run the server script from this workspace directory (`c:\Bill\CC\js\AI\Verite`):
   ```bash
   node TOOLS/postGresServer.js
   ```

**sources.csv access**
   Uses `sources.csv` from this folder, or falls back to `C:/Bill/CC/js/AI/ingest/sources.csv`.

> [!NOTE]
> Both of these commands have been added to your VS Code tasks. You can run them via the command palette by selecting **Tasks: Run Task** and choosing **Start Web Server** or **Start SSH Tunnel**.