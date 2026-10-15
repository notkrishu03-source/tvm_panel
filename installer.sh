# TuffNode TVM Panel — Installation
A web panel for managing KVM-style virtual machines, built with Next.js and PostgreSQL.
> The panel simulates VM operations in the database. To control real QEMU/KVM
> guests, wire the `// driver:` hooks in `src/lib/vm.ts` to libvirt / qemu.
## Quick install (Linux server)
From the **project root** (where `package.json` lives):
```bash
sudo bash install.sh
```
The installer will:
1. Install Node.js 22 and PostgreSQL (apt / dnf / yum supported).
2. Create a database and role.
3. Write a `.env` file with `DATABASE_URL`, admin credentials and port.
4. Install dependencies, apply the schema, and build the app.
5. Optionally run it under PM2 so it survives reboots.
### Non-interactive example
```bash
sudo PANEL_PORT=3000 \
     DB_NAME=tvm DB_USER=tvm DB_PASS=secret \
     ADMIN_USERNAME=admin ADMIN_PASSWORD=changeme \
     USE_PM2=yes bash install.sh
```
When it finishes it prints the URL and admin login. **Change the admin password
after the first sign-in** (Account page).
## Manual install
```bash
# 1. Requirements: Node.js >= 20 and PostgreSQL
# 2. Configure the database connection
cp .env.example .env    # or create .env
#    DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/dbname
#    ADMIN_USERNAME=admin
#    ADMIN_PASSWORD=changeme
npm install
npx drizzle-kit push    # create the tables
npm run build
npm run start           # serves on $PORT (default 3000)
```
Open `http://<server-ip>:3000` and sign in with the admin credentials
(default `admin` / `admin123` if not overridden).
## Environment variables
| Variable         | Required | Default        | Description                          |
| ---------------- | -------- | -------------- | ------------------------------------ |
| `DATABASE_URL`   | yes      | —              | PostgreSQL connection string         |
| `ADMIN_USERNAME` | no       | `admin`        | Seeded admin username (first run)    |
| `ADMIN_PASSWORD` | no       | `admin123`     | Seeded admin password (first run)    |
| `PORT`           | no       | `3000`         | Port the server listens on           |
## Managing the service (PM2)
```bash
pm2 status
pm2 logs tvm-panel
pm2 restart tvm-panel
pm2 stop tvm-panel
```