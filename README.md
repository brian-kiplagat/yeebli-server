# 🚀 Hono Starter

A Hono starter boilerplate for TypeScript with minimal dependencies and a clean architecture. All dependencies are
initiated at the start of the application and passed to the controllers and services. A swagger API doc is attached in
the static folder: `openapi.yaml`.

### 📚 API Doc powered by Swagger UI

<img width="1538" alt="Screenshot 2024-09-28 at 12 48 21 AM" src="https://github.com/user-attachments/assets/7b1ea200-30ef-4ad6-937d-e6767905e41e">

### 💾 Database browser powered by Drizzle Studio

<img width="1571" alt="Screenshot 2024-09-28 at 12 46 26 AM" src="https://github.com/user-attachments/assets/c8d43dd4-9d93-4ae7-8a4c-7756b84ef9f7">

## 🛠️ Stack

- 🔐 Authentication: JWT
- ✅ Validation: Zod
- ⚙️ Worker: BullMQ
- 📝 Logging: Pino
- 🗄️ ORM: Drizzle
- 📊 Queue: Redis
- 💾 DB: MySQL
- ⚡ Runtime: NodeJS
- 🚀 Framework: Hono
- 🎨 Formatter: Biome
- 📚 API Doc: Swagger
- 📝 Language: TypeScript
- 📦 Package Manager: PNPM

## 🚀 Getting Started

### 1. 📦 Install dependencies

```bash
pnpm install
pnpm install -g typescript
pnpm install -g pino-pretty
```

### 2. 🐳 Spin docker for development

Create a new file `.env` in the root folder and copy contents from the `.env.template` file and run this command. You must have docker installed on your computer. If not, skip to `Install Docker Desktop` then return here once done. Ideally for local development you only need to run this step once to install require dependencies like mysql. Subsequently you can just turn the container on or off at will in Docker desktop

```bash
docker compose up -d
```

## 💾 Database Configuration

### MySQL Configuration

The MySQL database is configured in `docker-compose.yml` with the following settings:

```yaml
db:
  image: mysql
  restart: no
  ports:
    - '3306:3306'
  volumes:
    - mysql_data:/var/lib/mysql
  environment:
    MYSQL_ROOT_PASSWORD: password
    MYSQL_USER: admin
    MYSQL_PASSWORD: Wagwan!2001
    MYSQL_DATABASE: hono
```

- **Database Name**: `hono`
- **Admin User**: `admin`
- **Admin Password**: `Wagwan!2001`
- **Root Password**: `password`
- **Port**: 3306
- **Data Persistence**: Data is stored in a Docker volume named `mysql_data`

### Database Setup

#### Generate Database Schema

```bash
pnpm run db:generate
```

#### Run Migrations

```bash
pnpm run db:migrate
```

### Accessing MySQL

#### Using Docker

```bash
# List running containers
docker ps

# Access MySQL inside container
docker exec -it <CONTAINER_ID> mysql -u admin -p
```

#### Using WSL (Windows)

1. Open WSL:

```powershell
wsl
```

2. Connect to MySQL:

```bash
sudo docker exec -it <CONTAINER_ID> mysql -u admin -p
```

3. Verify database access:

```sql
SHOW DATABASES;
USE hono;
SHOW TABLES;
```

### Drizzle Studio

For database browsing and management:

```bash
pnpm drizzle-kit studio
open https://local.drizzle.studio/
```

## 🚀 Local Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Development Server

```bash
pnpm run dev
```

The server will start on `http://localhost:3000`

### 3. Access API Documentation

The Swagger UI documentation is available at:

```
http://localhost:3000/doc
```

### 4. API Routes

The server exposes the following main API routes:

- `/v1/user` - User management and authentication
- `/v1/lead` - Lead management
- `/v1/event` - Event management
- `/v1/admin` - Admin operations
- `/v1/s3` - S3 file operations
- `/v1/asset` - Asset management
- `/v1/stripe` - Stripe payment integration
- `/v1/subscription` - Subscription management
- `/v1/booking` - Booking management
- `/v1/business` - Business management
- `/v1/membership` - Membership management
- `/v1/team` - Team management
- `/v1/contact` - Contact management
- `/v1/callback` - Callback management
- `/v1/podcast` - Podcast management

For detailed API documentation, visit the Swagger UI at `/doc`

## 📚 API Documentation

The OpenAPI YAML doc is in the `static` folder.

If you need the JSON file, it can be generated with the help of `yq`.

https://github.com/mikefarah/yq

```bash
yq eval -o=json static/openapi.yaml > static/openapi.json
```

## 🐳 Docker Installation (Windows)

To install Docker on Windows, you'll need to install **Docker Desktop** and **WSL 2** (Windows Subsystem for Linux). Below are the step-by-step instructions:

### 1. 🐧 Enable WSL 2 and Install a Linux Distribution

1. Open **PowerShell as Administrator** and run:
   ```powershell
   wsl --install
   ```
2. Restart your computer after installation.

### 2. 🐳 Install Docker Desktop

1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
2. Run the installer and ensure "Use WSL 2 instead of Hyper-V" is checked
3. Click Install and restart when prompted

### 3. ⚙️ Configure Docker

1. Open Docker Desktop
2. Go to Settings > General
3. Check "Use the WSL 2 based engine"
4. Click Apply & Restart

### 4. ✅ Verify Installation

```powershell
docker --version
docker run hello-world
```

### Troubleshooting

- If the container is not running:
  ```bash
  docker start <CONTAINER_ID>
  ```
- Check all containers:
  ```bash
  docker ps -a
  ```
- View container logs:
  ```bash
  docker logs <CONTAINER_ID>
  ```

![image](https://github.com/user-attachments/assets/f0878660-3184-4591-b7f2-ccda11a506dd)
