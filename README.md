# Mini Shopee

Backend API cho project Mini Shopee xây bằng Node.js, Express và MongoDB.

## Chạy local bằng Docker

Mode Docker hiện tại sẽ chạy:
- `app`: API Node.js ở cổng `3000`
- `mongo`: MongoDB local trong container ở cổng `27017`

Khi chạy bằng Docker, app dùng MongoDB nội bộ của Compose:

```text
mongodb://mongo:27017/minishop
```

Vì vậy `MONGODB_URI` Atlas trong file `.env` của bạn không được dùng trong mode này.

## Yêu cầu

- Docker Desktop đã chạy
- Docker Compose v2

Kiểm tra nhanh:

```powershell
docker --version
docker compose version
```

## Cấu hình môi trường

Tạo hoặc cập nhật file `.env` ở thư mục gốc:

```env
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=
AWS_REGION=
AWS_BUCKET_NAME=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

Lưu ý:
- Không cần khai báo `MONGODB_URI` khi chạy Docker local với cấu hình hiện tại.
- `GOOGLE_CLIENT_ID` là optional.
- AWS S3 là optional. Nếu để trống, ảnh sẽ lưu local trong `uploads/`.

## Chạy project

Chạy bằng Docker Compose:

```powershell
docker compose up --build
```

Hoặc dùng script trong `package.json`:

```powershell
npm run docker:up
```

Nếu PowerShell chặn `npm.ps1`, dùng:

```powershell
cmd /c npm run docker:up
```

Sau khi chạy thành công:
- API: `http://localhost:3000`
- Health check: `GET http://localhost:3000/`
- MongoDB local: `mongodb://127.0.0.1:27017`

## Các lệnh hữu ích

Xem log app:

```powershell
docker compose logs -f app
```

Dừng container:

```powershell
docker compose down
```

Dừng và xóa luôn dữ liệu MongoDB local:

```powershell
docker compose down -v
```

Build lại từ đầu:

```powershell
docker compose up --build
```

## Kết nối MongoDB bằng Compass

Nếu muốn xem dữ liệu bằng MongoDB Compass, dùng:

```text
mongodb://127.0.0.1:27017
```

Database của app là:

```text
minishop
```

## Dữ liệu ảnh upload

Ảnh upload local được lưu ở thư mục:

```text
uploads/
```

Thư mục này đã được mount vào container nên dữ liệu ảnh vẫn còn trên máy sau khi restart container.

## Kiểm tra nhanh sau khi chạy

1. Mở `http://localhost:3000/`
2. Gọi `POST /auth/register`
3. Gọi `POST /auth/login`
4. Tạo category, product, cart, checkout theo các phase đã làm

## CI

Repo đã có GitHub Actions workflow tại:

```text
.github/workflows/ci.yml
```

Workflow này sẽ:
- cài dependency
- chạy `npm run check`
- smoke-load app
- build Docker image

## Ghi chú

- Nếu bạn muốn Docker dùng MongoDB Atlas thay vì MongoDB local, cần sửa `docker-compose.yml`.
- Phần deploy lên server, Nginx và production hosting chưa được cấu hình trong README này.
