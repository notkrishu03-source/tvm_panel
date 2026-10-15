#!/usr/bin/env bash
#
# TuffNode TVM Panel — installer
#
# Installs Node.js, PostgreSQL, project dependencies, applies the database
# schema, builds the app and (optionally) runs it under PM2 behind the port
# of your choice.
#
# Usage:
#   sudo bash install.sh
#
# Non-interactive example:
#   sudo PANEL_PORT=3000 DB_NAME=tvm DB_USER=tvm DB_PASS=secret \
#        ADMIN_USERNAME=admin ADMIN_PASSWORD=changeme \
#        USE_PM2=yes bash install.sh
#
set -euo pipefail
# ------------------------------------------------------------------ helpers
C_RESET="\033[0m"; C_INFO="\033[1;34m"; C_OK="\033[1;32m"; C_WARN="\033[1;33m"; C_ERR="\033[1;31m"
info()  { echo -e "${C_INFO}==>${C_RESET} $*"; }
ok()    { echo -e "${C_OK}✓${C_RESET} $*"; }
warn()  { echo -e "${C_WARN}!${C_RESET} $*"; }
die()   { echo -e "${C_ERR}✗ $*${C_RESET}" >&2; exit 1; }
have()  { command -v "$1" >/dev/null 2>&1; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
[[ -f package.json ]] || die "Run this script from the panel project root (package.json not found)."
# ------------------------------------------------------------------ config
PANEL_PORT="${PANEL_PORT:-3000}"
DB_NAME="${DB_NAME:-tvm_panel}"
DB_USER="${DB_USER:-tvm}"
DB_PASS="${DB_PASS:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
USE_PM2="${USE_PM2:-ask}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SUDO=""
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  have sudo || die "Please run as root or install sudo."
  SUDO="sudo"
fi
rand() { tr -dc 'A-Za-z0-9' </dev/urandom | head -c "${1:-24}"; }
# ------------------------------------------------------------------ banner
echo
echo "  ╔══════════════════════════════════════════╗"
echo "  ║      TuffNode  TVM  Panel  Installer      ║"
echo "  ╚══════════════════════════════════════════╝"
echo
# ------------------------------------------------------------------ interactive prompts
if [[ -t 0 ]]; then
  read -rp "Panel port [$PANEL_PORT]: " _in && PANEL_PORT="${_in:-$PANEL_PORT}"
  read -rp "Database name [$DB_NAME]: " _in && DB_NAME="${_in:-$DB_NAME}"
  read -rp "Database user [$DB_USER]: " _in && DB_USER="${_in:-$DB_USER}"
  read -rp "Database password [auto-generate]: " _in && DB_PASS="${_in:-$DB_PASS}"
  read -rp "Admin username [$ADMIN_USERNAME]: " _in && ADMIN_USERNAME="${_in:-$ADMIN_USERNAME}"
  read -rp "Admin password [auto-generate]: " _in && ADMIN_PASSWORD="${_in:-$ADMIN_PASSWORD}"
  if [[ "$USE_PM2" == "ask" ]]; then
    read -rp "Run the panel with PM2 at boot? [Y/n]: " _in
    case "${_in:-y}" in [Nn]*) USE_PM2="no";; *) USE_PM2="yes";; esac
  fi
fi
[[ -z "$DB_PASS" ]]        && DB_PASS="$(rand 24)"        && warn "Generated DB password."
[[ -z "$ADMIN_PASSWORD" ]] && ADMIN_PASSWORD="$(rand 16)" && warn "Generated admin password."
[[ "$USE_PM2" == "ask" ]]  && USE_PM2="no"
# ------------------------------------------------------------------ package manager
PKG=""
if   have apt-get; then PKG="apt"
elif have dnf;     then PKG="dnf"
elif have yum;     then PKG="yum"
else die "Unsupported distro: need apt, dnf or yum."; fi
info "Using package manager: $PKG"
pkg_install() {
  case "$PKG" in
    apt) $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y "$@";;
    dnf) $SUDO dnf install -y "$@";;
    yum) $SUDO yum install -y "$@";;
  esac
}
info "Updating package lists..."
case "$PKG" in
  apt) $SUDO apt-get update -y;;
  dnf) $SUDO dnf makecache -y || true;;
  yum) $SUDO yum makecache -y || true;;
esac
have curl || pkg_install curl ca-certificates
have git  || pkg_install git || true
# ------------------------------------------------------------------ Node.js
install_node() {
  info "Installing Node.js ${NODE_MAJOR}.x ..."
  if [[ "$PKG" == "apt" ]]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO -E bash -
    pkg_install nodejs
  else
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO -E bash -
    pkg_install nodejs
  fi
}
if have node; then
  CUR="$(node -v | sed 's/^v//;s/\..*//')"
  if (( CUR < 20 )); then
    warn "Node $(node -v) is too old; upgrading."
    install_node
  else
    ok "Node $(node -v) already installed."
  fi
else
  install_node
fi
have npm || die "npm not found after installing Node.js."
ok "node $(node -v) / npm $(npm -v)"
# ------------------------------------------------------------------ PostgreSQL
install_postgres() {
  info "Installing PostgreSQL ..."
  case "$PKG" in
    apt) pkg_install postgresql postgresql-contrib;;
    dnf) pkg_install postgresql-server postgresql-contrib
         [[ -d /var/lib/pgsql/data/base ]] || $SUDO postgresql-setup --initdb || true;;
    yum) pkg_install postgresql-server postgresql-contrib
         [[ -d /var/lib/pgsql/data/base ]] || $SUDO postgresql-setup initdb || true;;
  esac
}
if have psql; then
  ok "PostgreSQL already installed."
else
  install_postgres
fi
# start + enable service
if have systemctl; then
  $SUDO systemctl enable postgresql >/dev/null 2>&1 || true
  $SUDO systemctl start postgresql  >/dev/null 2>&1 || \
    $SUDO systemctl start postgresql.service >/dev/null 2>&1 || \
    warn "Could not start postgresql via systemctl; start it manually if needed."
fi
# ------------------------------------------------------------------ database + role
info "Configuring database '$DB_NAME' and role '$DB_USER' ..."
psql_su() { $SUDO -u postgres psql -v ON_ERROR_STOP=1 -tAc "$1"; }
if ! psql_su "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}';" | grep -q 1; then
  psql_su "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';"
  ok "Created role ${DB_USER}."
else
  psql_su "ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';"
  warn "Role ${DB_USER} already existed; password reset."
fi
if ! psql_su "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" | grep -q 1; then
  $SUDO -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
  ok "Created database ${DB_NAME}."
else
  warn "Database ${DB_NAME} already exists; reusing it."
fi
psql_su "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" || true
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
# ------------------------------------------------------------------ .env
info "Writing .env ..."
if [[ -f .env ]]; then
  cp .env ".env.bak.$(date +%s)"
  warn "Existing .env backed up."
fi
cat > .env <<EOF
# Generated by install.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATABASE_URL=${DATABASE_URL}
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
PORT=${PANEL_PORT}
NODE_ENV=production
EOF
chmod 600 .env
ok ".env written."
# ------------------------------------------------------------------ dependencies
info "Installing project dependencies (npm ci / install) ..."
if [[ -f package-lock.json ]]; then
  npm ci || npm install
else
  npm install
fi
ok "Dependencies installed."
# ------------------------------------------------------------------ schema
info "Applying database schema (drizzle-kit push) ..."
npx drizzle-kit push --force || npx drizzle-kit push
ok "Schema applied."
# ------------------------------------------------------------------ build
info "Building the panel (this can take a minute) ..."
npm run build
ok "Build complete."
# ------------------------------------------------------------------ run
if [[ "$USE_PM2" == "yes" ]]; then
  have pm2 || { info "Installing PM2 ..."; $SUDO npm install -g pm2; }
  info "Starting panel with PM2 on port ${PANEL_PORT} ..."
  pm2 delete tvm-panel >/dev/null 2>&1 || true
  PORT="${PANEL_PORT}" pm2 start npm --name tvm-panel -- run start
  pm2 save
  if have systemctl; then
    STARTUP_CMD="$(pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null | grep 'sudo' || true)"
    [[ -n "$STARTUP_CMD" ]] && eval "$STARTUP_CMD" || true
  fi
  ok "Panel running under PM2 (pm2 logs tvm-panel)."
fi
# ------------------------------------------------------------------ summary
echo
echo "  ╔══════════════════════════════════════════╗"
echo "  ║          Installation complete           ║"
echo "  ╚══════════════════════════════════════════╝"
echo
ok  "URL:            http://<server-ip>:${PANEL_PORT}"
ok  "Admin login:    ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}"
ok  "Database URL:   ${DATABASE_URL}"
echo
if [[ "$USE_PM2" == "yes" ]]; then
  echo "  Manage:  pm2 restart tvm-panel | pm2 logs tvm-panel | pm2 stop tvm-panel"
else
  echo "  Start manually:  PORT=${PANEL_PORT} npm run start"
fi
echo
warn "Change the admin password after first login (Account page)."
echo
