#!/usr/bin/env bash
#
# TuffNode TVM Panel — Installation Script
# A web panel for managing KVM-style virtual machines (Next.js + PostgreSQL)
#
# Supports: Debian/Ubuntu (apt), RHEL/CentOS/Fedora (dnf/yum), Arch (pacman)
#
# Usage:
#   sudo bash install.sh
#
# Non-interactive example:
#   sudo PANEL_PORT=3000 DB_NAME=tvm DB_USER=tvm DB_PASS=secret \
#        ADMIN_USERNAME=admin ADMIN_PASSWORD=changeme USE_PM2=yes bash install.sh
#

set -euo pipefail

# ==========================================
# CONFIGURATION & DEFAULTS
# ==========================================
NODE_MAJOR=22
APP_NAME="tvm-panel"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${APP_DIR}/.env"

# Database defaults
DB_NAME="${DB_NAME:-tvm}"
DB_USER="${DB_USER:-tvm}"
DB_PASS="${DB_PASS:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

# App defaults
PANEL_PORT="${PANEL_PORT:-${PORT:-3000}}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
USE_PM2="${USE_PM2:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ==========================================
# LOGGING HELPERS
# ==========================================
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }
step()  { echo -e "\n${BOLD}${CYAN}==>${NC} ${BOLD}$*${NC}"; }

# ==========================================
# PRE-FLIGHT CHECKS
# ==========================================
if [[ "${EUID}" -ne 0 ]]; then
  fail "This installer must be run as root. Try: sudo bash install.sh"
fi

if [[ ! -f "${APP_DIR}/package.json" ]]; then
  fail "package.json not found in ${APP_DIR}. Run this script from the project root."
fi

echo -e "${BOLD}"
echo "  🖥️   TuffNode TVM Panel — Installer"
echo "  ================================================"
echo -e "${NC}"

# ==========================================
# PROMPT FOR ENV VALUES
# ==========================================
prompt_if_empty() {
  local var_name="$1"
  local prompt_text="$2"
  local default_val="${3:-}"
  local current_val="${!var_name:-}"

  if [[ -z "${current_val}" ]]; then
    if [[ -n "${default_val}" ]]; then
      read -rp "$(echo -e "${CYAN}${prompt_text}${NC} [${default_val}]: ")" input
      printf -v "${var_name}" '%s' "${input:-$default_val}"
    else
      read -rp "$(echo -e "${CYAN}${prompt_text}${NC}: ")" input
      printf -v "${var_name}" '%s' "${input}"
    fi
  fi
}

step "Database Configuration"
prompt_if_empty DB_NAME "PostgreSQL database name" "tvm"
prompt_if_empty DB_USER "PostgreSQL username" "tvm"

if [[ -z "${DB_PASS}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    DB_PASS="$(openssl rand -hex 16)"
    info "Auto-generated DB password: ${DB_PASS}"
  else
    prompt_if_empty DB_PASS "PostgreSQL password" ""
  fi
fi

prompt_if_empty DB_HOST "PostgreSQL host" "127.0.0.1"
prompt_if_empty DB_PORT "PostgreSQL port" "5432"

step "Panel & Admin Configuration"
prompt_if_empty PANEL_PORT   "Panel port" "3000"
prompt_if_empty ADMIN_USERNAME "Admin username" "admin"
prompt_if_empty ADMIN_PASSWORD "Admin password" "admin123"

step "Process Manager"
if [[ -z "${USE_PM2}" ]]; then
  read -rp "$(echo -e "${CYAN}Install & run under PM2 so it survives reboots? (yes/no)${NC} [yes]: ")" input
  USE_PM2="${input:-yes}"
fi

# ==========================================
# DETECT PACKAGE MANAGER
# ==========================================
detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then echo "apt"
  elif command -v dnf >/dev/null 2>&1; then echo "dnf"
  elif command -v yum >/dev/null 2>&1; then echo "yum"
  elif command -v pacman >/dev/null 2>&1; then echo "pacman"
  else echo "unknown"; fi
}

PKG_MGR="$(detect_pkg_manager)"
info "Detected package manager: ${PKG_MGR}"

# ==========================================
# INSTALL BASE DEPENDENCIES
# ==========================================
install_base_deps() {
  step "Installing base dependencies (curl, git, ca-certificates, build tools)"

  case "${PKG_MGR}" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      apt-get install -y -qq curl git ca-certificates build-essential openssl >/dev/null
      ;;
    dnf)
      dnf install -y -q curl git ca-certificates gcc-c++ make openssl >/dev/null
      ;;
    yum)
      yum install -y -q curl git ca-certificates gcc-c++ make openssl >/dev/null
      ;;
    pacman)
      pacman -Sy --noconfirm --needed curl git ca-certificates base-devel openssl >/dev/null
      ;;
    *)
      fail "Unsupported package manager. Please install dependencies manually."
      ;;
  esac

  ok "Base dependencies installed."
}

# ==========================================
# INSTALL NODE.JS
# ==========================================
install_node() {
  step "Checking Node.js installation (need >= v20)"

  local required_major=20

  if command -v node >/dev/null 2>&1; then
    local current_major
    current_major="$(node -v | sed 's/v//' | cut -d. -f1)"
    if [[ "${current_major}" -ge "${required_major}" ]]; then
      ok "Node.js $(node -v) already installed."
      return 0
    fi
    warn "Node.js $(node -v) too old. Installing Node.js ${NODE_MAJOR}..."
  else
    info "Installing Node.js ${NODE_MAJOR}..."
  fi

  case "${PKG_MGR}" in
    apt)
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
      apt-get install -y -qq nodejs >/dev/null
      ;;
    dnf|yum)
      curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
      "${PKG_MGR}" install -y -q nodejs >/dev/null
      ;;
    pacman)
      pacman -Sy --noconfirm --needed nodejs npm >/dev/null
      ;;
    *)
      fail "Cannot auto-install Node.js. Install manually >= v20."
      ;;
  esac

  command -v node >/dev/null 2>&1 || fail "Node.js installation failed."
  ok "Node.js $(node -v) installed."
}

# ==========================================
# INSTALL & START POSTGRESQL
# ==========================================
install_postgres() {
  step "Installing PostgreSQL"

  if command -v psql >/dev/null 2>&1; then
    ok "PostgreSQL client already installed: $(psql --version)"
  else
    case "${PKG_MGR}" in
      apt)
        apt-get install -y -qq postgresql postgresql-contrib >/dev/null
        ;;
      dnf|yum)
        "${PKG_MGR}" install -y -q postgresql-server postgresql-contrib >/dev/null
        if [[ ! -f /var/lib/pgsql/data/PG_VERSION ]]; then
          postgresql-setup --initdb >/dev/null 2>&1 || true
        fi
        ;;
      pacman)
        pacman -Sy --noconfirm --needed postgresql >/dev/null
        if [[ ! -f /var/lib/postgres/data/PG_VERSION ]]; then
          sudo -u postgres initdb -D /var/lib/postgres/data >/dev/null 2>&1 || true
        fi
        ;;
      *)
        fail "Cannot auto-install PostgreSQL."
        ;;
    esac
    ok "PostgreSQL installed."
  fi

  # Start & enable the service
  step "Starting PostgreSQL service"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable postgresql >/dev/null 2>&1 || true
    systemctl start postgresql >/dev/null 2>&1 || systemctl restart postgresql >/dev/null 2>&1 || true
  fi

  # Wait for postgres to be ready
  local retries=20
  while ! sudo -u postgres psql -c '\q' >/dev/null 2>&1; do
    retries=$((retries - 1))
    if [[ "${retries}" -le 0 ]]; then
      fail "PostgreSQL did not start in time."
    fi
    sleep 1
  done

  ok "PostgreSQL is running."
}

# ==========================================
# CREATE DB ROLE & DATABASE
# ==========================================
setup_database() {
  step "Creating database role '${DB_USER}' and database '${DB_NAME}'"

  # Escape any single quotes in password
  local safe_pass
  safe_pass="${DB_PASS//\'/\'\'}"

  # Create or update the role
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL >/dev/null
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE "${DB_USER}" LOGIN PASSWORD '${safe_pass}';
  ELSE
    ALTER ROLE "${DB_USER}" WITH LOGIN PASSWORD '${safe_pass}';
  END IF;
END
\$\$;
SQL

  # Create the database if it doesn't exist
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
    ok "Database '${DB_NAME}' created."
  else
    warn "Database '${DB_NAME}' already exists — reusing."
  fi

  # Grant privileges
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL >/dev/null
GRANT ALL PRIVILEGES ON DATABASE "${DB_NAME}" TO "${DB_USER}";
SQL

  # Grant schema-level privileges (needed for Postgres 15+)
  sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<SQL >/dev/null
GRANT ALL ON SCHEMA public TO "${DB_USER}";
ALTER SCHEMA public OWNER TO "${DB_USER}";
SQL

  ok "Database privileges granted."
}

# ==========================================
# WRITE .env FILE
# ==========================================
write_env_file() {
  step "Writing .env configuration"

  if [[ -f "${ENV_FILE}" ]]; then
    local backup="${ENV_FILE}.bak.$(date +%s)"
    cp "${ENV_FILE}" "${backup}"
    warn "Existing .env backed up to ${backup}"
  fi

  cat > "${ENV_FILE}" <<EOF
# ==========================================
# TUFFNODE TVM PANEL (.env)
# Generated by install.sh on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# ==========================================

DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}

ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

PORT=${PANEL_PORT}
NODE_ENV=production
EOF

  chmod 600 "${ENV_FILE}"
  ok ".env written to ${ENV_FILE} (permissions: 600)"
}

# ==========================================
# INSTALL NPM DEPENDENCIES
# ==========================================
install_deps() {
  step "Installing npm dependencies"
  cd "${APP_DIR}"

  if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund 2>&1 | tail -n 5
  else
    npm install --no-audit --no-fund 2>&1 | tail -n 5
  fi

  ok "npm dependencies installed."
}

# ==========================================
# APPLY DB SCHEMA (DRIZZLE)
# ==========================================
apply_schema() {
  step "Applying database schema"

  cd "${APP_DIR}"

  # Load .env for drizzle-kit
  set -o allexport
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +o allexport

  if [[ -f "drizzle.config.ts" ]] || [[ -f "drizzle.config.js" ]]; then
    if npx drizzle-kit push --force 2>&1 | tail -n 15; then
      ok "Database schema applied via drizzle-kit."
    else
      warn "drizzle-kit push failed. You may need to run 'npx drizzle-kit push' manually."
    fi
  else
    warn "No drizzle.config found — skipping schema push."
    warn "Run 'npx drizzle-kit push' manually if your project uses Drizzle."
  fi
}

# ==========================================
# BUILD THE APP
# ==========================================
build_app() {
  step "Building Next.js application"
  cd "${APP_DIR}"

  if npm run build 2>&1 | tail -n 20; then
    ok "Build completed successfully."
  else
    fail "Build failed. Check the output above."
  fi
}

# ==========================================
# SETUP PM2
# ==========================================
setup_pm2() {
  step "Setting up PM2 process manager"

  if ! command -v pm2 >/dev/null 2>&1; then
    info "Installing PM2 globally..."
    npm install -g pm2 --no-audit --no-fund >/dev/null 2>&1
  fi

  cd "${APP_DIR}"

  # Delete existing process if present
  pm2 delete "${APP_NAME}" >/dev/null 2>&1 || true

  # Load env and start
  set -o allexport
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +o allexport

  pm2 start npm \
    --name "${APP_NAME}" \
    --time \
    --restart-delay=5000 \
    --max-restarts=20 \
    -- start >/dev/null 2>&1

  pm2 save >/dev/null 2>&1

  # Configure startup on boot
  local startup_cmd
  startup_cmd="$(pm2 startup systemd -u root --hp /root 2>&1 | grep -E '^sudo' || true)"
  if [[ -n "${startup_cmd}" ]]; then
    eval "${startup_cmd}" >/dev/null 2>&1 || true
  fi

  ok "PM2 process '${APP_NAME}' started and saved."
  RUNNER="pm2"
}

# ==========================================
# SETUP SYSTEMD (fallback)
# ==========================================
setup_systemd() {
  step "Creating systemd service (${APP_NAME})"

  local node_bin
  node_bin="$(command -v node)"

  cat > "/etc/systemd/system/${APP_NAME}.service" <<EOF
[Unit]
Description=TuffNode TVM Panel (Next.js)
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
ExecStart=${node_bin} ${APP_DIR}/node_modules/.bin/next start -p ${PANEL_PORT}
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
EnvironmentFile=${ENV_FILE}
Environment=NODE_ENV=production
Environment=PORT=${PANEL_PORT}

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "${APP_NAME}" >/dev/null 2>&1 || true
  systemctl restart "${APP_NAME}" >/dev/null 2>&1 || true
  ok "Systemd service '${APP_NAME}' enabled and started."
  RUNNER="systemd"
}

# ==========================================
# FIREWALL (optional best-effort)
# ==========================================
open_firewall_port() {
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow "${PANEL_PORT}/tcp" >/dev/null 2>&1 || true
    info "Opened UFW port ${PANEL_PORT}."
  elif command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-port="${PANEL_PORT}/tcp" >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
    info "Opened firewalld port ${PANEL_PORT}."
  fi
}

# ==========================================
# MAIN
# ==========================================
main() {
  install_base_deps
  install_node
  install_postgres
  setup_database
  write_env_file
  install_deps
  apply_schema
  build_app

  if [[ "${USE_PM2}" =~ ^(yes|y|true|1)$ ]]; then
    setup_pm2
  else
    setup_systemd
  fi

  open_firewall_port

  # ==========================================
  # SUMMARY
  # ==========================================
  local server_ip
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -z "${server_ip}" ]] && server_ip="<server-ip>"

  echo ""
  echo -e "${BOLD}${GREEN}=================================================="
  echo "  🖥️   TuffNode TVM Panel Installed!"
  echo -e "==================================================${NC}"
  echo ""
  echo -e "  ${BOLD}Install Directory:${NC}  ${APP_DIR}"
  echo -e "  ${BOLD}Environment File:${NC}   ${ENV_FILE}"
  echo -e "  ${BOLD}Process Manager:${NC}    ${RUNNER}"
  echo -e "  ${BOLD}Database:${NC}           postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
  echo ""
  echo -e "  ${BOLD}🌐 Panel URL:${NC}        http://${server_ip}:${PANEL_PORT}"
  echo -e "  ${BOLD}👤 Admin Username:${NC}   ${ADMIN_USERNAME}"
  echo -e "  ${BOLD}🔑 Admin Password:${NC}   ${ADMIN_PASSWORD}"
  echo ""
  echo -e "  ${YELLOW}⚠️  Change the admin password after first sign-in (Account page).${NC}"
  echo ""

  if [[ "${RUNNER}" == "pm2" ]]; then
    echo -e "  ${BOLD}Service Commands:${NC}"
    echo "    pm2 status"
    echo "    pm2 logs ${APP_NAME}"
    echo "    pm2 restart ${APP_NAME}"
    echo "    pm2 stop ${APP_NAME}"
  else
    echo -e "  ${BOLD}Service Commands:${NC}"
    echo "    systemctl status ${APP_NAME}"
    echo "    journalctl -u ${APP_NAME} -f"
    echo "    systemctl restart ${APP_NAME}"
    echo "    systemctl stop ${APP_NAME}"
  fi

  echo ""
  echo -e "  ${BOLD}Notes:${NC}"
  echo "    • The panel simulates VM operations in the database."
  echo "    • To control real QEMU/KVM guests, wire the '// driver:' hooks"
  echo "      in 'src/lib/vm.ts' to libvirt / qemu."
  echo ""
  echo -e "${GREEN}Done!${NC}"
}

main "$@"
