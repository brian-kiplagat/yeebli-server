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

### 3. 🗄️ Database Setup

#### Generate

```bash
pnpm run db:generate
```

#### Migrate

```bash
pnpm run db:migrate
```

### 4. 🚀 Run the app

```bash
pnpm run dev
open http://localhost:3000/doc
```

## 📚 API Documentation

The OpenAPI YAML doc is in the `static` folder.

If you need the JSON file, it can be generated with the help of `yq`.

https://github.com/mikefarah/yq

```bash
yq eval -o=json static/openapi.yaml > static/openapi.json
```

And the JSON doc will be generated.

## 💾 Drizzle Studio For Database Browsing

```bash
pnpm drizzle-kit studio
open https://local.drizzle.studio/
```

## 🐳 Docker for local development

To install Docker on Windows, you'll need to install **Docker Desktop** and **WSL 2** (Windows Subsystem for Linux). Below are the step-by-step instructions:

---

## **1. 🐧 Enable WSL 2 and Install a Linux Distribution**

WSL 2 is required for Docker to run on Windows efficiently.

### **Step 1: Enable WSL**

1. Open **PowerShell as Administrator** and run the following command to enable WSL:

   ```powershell
   wsl --install
   ```

   This will install the default Linux distribution (Ubuntu) and enable WSL 2.

2. Restart your computer after installation.

---

## **2. 🐳 Install Docker Desktop**

### **Step: Download Docker Desktop**

- Visit the [official Docker website](https://www.docker.com/products/docker-desktop) and download **Docker Desktop for Windows**.

### **Step: Install Docker Desktop**

1. Run the **Docker Desktop Installer.exe** file.
2. In the installation settings:

   - Ensure **"Use WSL 2 instead of Hyper-V"** is checked.
   - Click **Install** and wait for the process to complete.

3. Once the installation is done, click **Close and restart**.

---

## **3. ⚙️ Configure Docker to Use WSL 2**

1. Open Docker Desktop.
2. Go to **Settings** > **General**.
3. Check **"Use the WSL 2 based engine"**.
4. Click **Apply & Restart**.

---

## **4. ✅ Verify Installation**

1. Open **PowerShell** or **Command Prompt** and run:

   ```powershell
   docker --version
   ```

   This should return the installed Docker version.

2. Run the **hello-world** container to test:
   ```powershell
   docker run hello-world
   ```
   If everything is set up correctly, you will see a message confirming that Docker is working.

---

### **Optional: 🔍 Confirm MySQL Works**

Once the migration is complete, and you've run:

```bash
pnpm run db:generate
pnpm run db:migrate
```

Confirm that MySQL inside the container works on the WSL Ubuntu command line using the credentials from your `.env` file.

To connect to MySQL using the `.env` credentials you provided (`DB_USER=user`, `DB_PASSWORD=password`), follow these steps:

---

### **1. 🐧 Open Ubuntu in WSL**

Run the following in **PowerShell** or **Command Prompt**:

```powershell
wsl
```

---

### **2. 📊 List Running Docker Containers**

Inside Ubuntu, check if MySQL is running in Docker:

```bash
docker ps
```

Look for the **CONTAINER ID** of the MySQL container.

---

### **3. 🔐 Access MySQL Inside the Container**

Now, use the **CONTAINER ID** to execute MySQL:

```bash
sudo docker exec -it <CONTAINER_ID> mysql -u user -p
```

Replace `<CONTAINER_ID>` with the actual ID from `docker ps`. When prompted, enter the **password** (`password` from `.env`).

---

### **4. ✅ Verify Database Access**

Once inside MySQL, check if the database exists:

```sql
SHOW DATABASES;
```

To use a specific database:

```sql
USE your_database_name;
SHOW TABLES;
```

---

### **5. 🚪 Exit MySQL**

To exit the MySQL shell, type:

```sql
EXIT;
```

![image](https://github.com/user-attachments/assets/f0878660-3184-4591-b7f2-ccda11a506dd)

---

### **Troubleshooting** 🔧

- If the container is not running, start it:
  ```bash
  docker start <CONTAINER_ID>
  ```
- If you don't see the container in `docker ps`, check all containers:
  ```bash
  docker ps -a
  ```
- If MySQL is not installed in Docker, check the logs:
  ```bash
  docker logs <CONTAINER_ID>
  ```

This ensures that MySQL is running correctly within the Docker container on WSL! 🚀

---

## 💾 How to Create a MySQL Database, User, and Import a SQL File

If you're setting up a MySQL database from scratch, here's how you can do it step-by-step. We'll create a database called `hono`, add a user, grant permissions, and then import a SQL file located at `/usr/sql/hono.sql`.

### 1. 🔐 Log in to MySQL as root

```bash
mysql -u root -p
```

Enter your root password when prompted.

---

### 2. 🏗️ Create the Database

Once inside the MySQL shell:

```sql
CREATE DATABASE hono;
```

---

### 3. 👤 Create a MySQL User

Still in the MySQL shell:

```sql
CREATE USER 'admin'@'%' IDENTIFIED BY 'Wagwan!2001';
```

You can replace `'%'` with `'localhost'` or `'192.169.....'` to be more specific.

---

### 4. ✅ Grant Privileges

Now give the user access to the `hono` database:

```sql
GRANT ALL PRIVILEGES ON hono.* TO 'admin'@'%';
FLUSH PRIVILEGES;
```

---

### 5. 📥 Exit MySQL

Type:

```sql
EXIT;
```

---

### 6. 📂 Import the SQL File

Back in your terminal (outside MySQL), run:

```bash
mysql -u user -p hono < /usr/sql/hono.sql
```

You'll be prompted to enter the password for `user`. This command imports all tables, data, and structure defined in the `hono.sql` file into the `hono` database.

---

That's it! Your MySQL database is now ready and loaded.

---

### **Conclusion** 🎉

Now you have **Docker** installed with **WSL 2** support. You can run Linux-based Docker containers efficiently on Windows! 🚀
