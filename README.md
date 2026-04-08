# 🚀 Zahro Dental Backend Api

This is a backend service for Zahro Dental  built with **NestJS**, **Prisma**, and **PostgreSQL**.
It includes authentication, role-based access control (RBAC), file storage using MinIO, and modular architecture for scalable applications.

---

## 🛠 Tech Stack

* **Framework:** NestJS
* **Language:** TypeScript
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Storage:** MinIO (S3-compatible)
* **Authentication:** JWT (Access & Refresh Tokens)

---

## 📦 Features

* 🔐 Authentication & Authorization (JWT + RBAC)
* 👥 User & Role Management

* 📁 File Upload (MinIO)
* 🧾 API Documentation (Swagger)

---

## ⚙️ Installation

```bash
git clone <your-repo-url>
cd <project-folder>
npm install
```

---

## 🔑 Environment Variables

Create `.env` file in the root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/db_name"

JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret

MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=your-bucket-name

ADMIN_PHONE=+9989*******
ADMIN_PASSWORD=admin!@#$


PORT=8088
```

---

## 🗄 Database Setup (Prisma)

### 1. Generate Prisma Client

```bash
npx prisma generate
```

### 2. Run Migrations

```bash
npx prisma migrate dev
```

### 3. (Optional) Seed Data

```bash
npm run seed
```

---

## ▶️ Running the App

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm run start:prod
```

---

## 📄 API Documentation

Swagger available at:

```
http://localhost:{port}/swagger
```

---

## 📁 Project Structure

```
src/
 ├── api/
 │   ├── auth/
 │   ├── admin
 │   ├── uploads/
 │   ├── minio/
 │   ├── users/
 │
 ├── commands/
 ├── config/
 ├── constantis/
 ├── decorators/
 ├── dto/
 ├── guards/
 ├── mixin/
 ├── services/
 ├── utils/
 ├── validator/
```

---

## 🐳 MinIO Setup (Local)

Run MinIO using Docker:

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  quay.io/minio/minio server /data --console-address ":9001"
```

MinIO Console:

```
http://localhost:9001
```

---

## 🔐 Roles

* **SUPER_ADMIN** – Full system access
* **ADMIN** – Organization-level control


---

## 📌 Notes

* Make sure PostgreSQL is running before starting the app
* Ensure MinIO bucket is created before uploading files
* Always run migrations before starting the project

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## 📄 License

This project is licensed under the MIT License.
