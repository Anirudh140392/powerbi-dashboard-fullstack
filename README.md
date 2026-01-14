# PowerBI Dashboard - Fullstack

A fullstack dashboard application with React frontend and Node.js backend.

## 🚀 Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/powerbi-dashboard-fullstack.git
cd powerbi-dashboard-fullstack

# Copy environment file and edit with your values
cp .env.example .env
nano .env

# Start all services
sudo docker compose up -d

# Check status
sudo docker compose ps
```

## 📦 Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 9000 | React + Vite dashboard |
| Backend | 5000 | Node.js API server |
| Redis | 6380 | Caching layer |

## 🔄 CI/CD Pipeline

This project uses GitHub Actions for automated deployment to EC2.

### Setup GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| `EC2_HOST` | EC2 public IP address |
| `EC2_USER` | SSH username (usually `ubuntu`) |
| `EC2_SSH_KEY` | Contents of your `.pem` file |

### Deployment

Push to `main` branch triggers automatic deployment:

```bash
git add .
git commit -m "Deploy update"
git push origin main
```

## 🛠️ Manual Deployment

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Navigate to app directory
cd /home/ubuntu/powerbi-dashboard-fullstack

# Pull latest changes
git pull origin main

# Rebuild and restart containers
sudo docker compose down
sudo docker compose build --no-cache
sudo docker compose up -d
```

## 📁 Project Structure

```
├── frontend/          # React + Vite frontend
├── backend/           # Node.js + Express API
├── docker-compose.yml # Container orchestration
├── .github/workflows/ # CI/CD pipeline
└── scripts/           # Deployment scripts
```
