# ReLED — Remote LED Controller

Control WS2812B LEDs over your LAN from any phone or browser.

## Stack
- **Backend**: Python + FastAPI + aiosqlite (SQLite for persistence)
- **Frontend**: Vanilla HTML/CSS/JS (mobile-first)
- **Infra**: Docker + GitHub Actions (self-hosted runner on Pi 5)

---

## 1. First-time setup on the Pi

### Clone the repo
```bash
git clone https://github.com/<your-username>/remoteLED.git
cd remoteLED
```

### Install the GitHub Actions self-hosted runner
> Go to your GitHub repo → **Settings → Actions → Runners → New self-hosted runner**
> Select **Linux / ARM64**, then follow the commands shown. They look like:

```bash
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-arm64-<version>.tar.gz -L https://github.com/actions/runner/releases/download/...
tar xzf actions-runner-linux-arm64-<version>.tar.gz
./config.sh --url https://github.com/<you>/remoteLED --token <TOKEN>
```

### Install the runner as a systemd service (runs on boot)
```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

### Start ReLED for the first time
```bash
cd ~/remoteLED
docker compose up --build -d
```

Access it at `http://<PI-IP>:9000`

---

## 2. Day-to-day workflow

```bash
# On your dev machine — edit code, then:
git add .
git commit -m "your message"
git push origin main
# → GitHub Actions triggers → Pi pulls, rebuilds, restarts automatically
```

---

## 3. ESP32 integration

Your ESP32 should `HTTP GET` the following endpoint every N milliseconds:

```
GET http://<PI-IP>:9000/api/state
```

Response:
```json
{
  "mode":       "solid",   // solid | rainbow | pulse | chase | sparkle
  "color":      "#ff8c00", // hex color
  "brightness": 200,       // 0–255
  "speed":      50         // 1–100 (ignored for solid mode)
}
```

---

## 4. Local dev (on your machine with uv)

```bash
uv run main.py
# → http://localhost:8000
```
