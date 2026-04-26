# Huong dan cai dat va chay du an
# Quan ly Thoi Khoa Bieu - Khoa CNTT

## Yeu cau he thong
- Node.js v18+
- PostgreSQL v14+
- pgAdmin4

---

## Buoc 1: Cai PostgreSQL

1. Tai PostgreSQL: https://www.postgresql.org/download/
2. Cai dat va tao tai khoan PostgreSQL local cua ban
   - Vi du user: `postgres`
   - Tu dat password rieng, khong commit vao repo
   - Port: `5432`

---

## Buoc 2: Tao database

1. Mo pgAdmin4
2. Tao database moi: `tkb_khoa_cntt`
3. Chay file SQL: `backend/sql/init_database.sql`

---

## Buoc 3: Cai dat backend

```bash
cd backend
npm install
copy .env.example .env
```

Chinh sua file `backend/.env` voi gia tri local cua ban:

```env
PORT=5000
ALLOWED_ORIGIN=http://localhost:3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tkb_khoa_cntt
DB_USER=your_postgres_user
DB_PASSWORD=your_database_password
JWT_SECRET=replace_with_a_random_secret_at_least_32_chars
```

Chay backend:

```bash
npm start
# hoac
npm run dev
```

---

## Buoc 4: Cai dat frontend

```bash
cd frontend
npm install
```

Chay frontend:

```bash
npm run dev
```

---

## Buoc 5: Truy cap

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api/health

---

## Tai khoan mac dinh

Sau khi chay seed data, cac tai khoan:

| Email | Mat khau | Vai tro |
|-------|----------|---------|
| admin@cntt.edu.vn | tkb123 | Admin |
| giaovu@cntt.edu.vn | tkb123 | Giao vu |
| gv1@cntt.edu.vn | tkb123 | Giang vien |
| sv1@cntt.edu.vn | tkb123 | Sinh vien |
| truongkhoa@cntt.edu.vn | tkb123 | Truong khoa |

---

## Cau truc thu muc

```text
WEB/
|-- backend/
|   |-- src/
|   |   |-- index.js
|   |   |-- config/db.js
|   |   |-- middleware/auth.js
|   |   `-- routes/
|   |       |-- auth.js
|   |       |-- giaoVu.js
|   |       |-- giangVien.js
|   |       |-- sinhVien.js
|   |       |-- truongKhoa.js
|   |       `-- admin.js
|   |-- .env.example
|   `-- package.json
|-- frontend/
|   |-- src/
|   |   |-- App.jsx
|   |   |-- pages/
|   |   |-- services/api.js
|   |   `-- context/AuthContext.jsx
|   `-- package.json
`-- README.md
```

## Luu y bao mat

- Khong commit file `backend/.env`
- Luon dung `backend/.env.example` lam mau cau hinh
- JWT secret phai la chuoi random dai it nhat 32 ky tu
- `ALLOWED_ORIGIN` phai trung voi frontend duoc phep goi API
- Neu credential cu da tung bi lo, hay rotate ngay
