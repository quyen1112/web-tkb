# Thiết kế Frontend — Hệ thống Quản lý Thời Khóa Biểu Khoa CNTT

> **Nguồn tham chiếu:** backend codebase (SQL schemas, routes, controllers).
> Mọi entity, API, ràng buộc đều dựa trên backend thực tế.
> Feature không có API backend → đánh dấu **giả định**.

---

## 1. Tổng quan hệ thống

### Hệ thống làm gì
Quản lý thời khóa biểu (TKB) toàn khoa CNTT: tạo, duyệt, công bố TKB theo học kỳ.
Hỗ trợ 5 vai trò: **admin**, **giao vụ**, **giảng viên**, **sinh viên**, **trưởng khoa**.

### Mục tiêu frontend
- Giao diện web phân vai trò rõ ràng, mỗi role có layout riêng
- Hiển thị TKB dạng lưới (grid tuần 7×11), thao tác nhanh cho giao vụ
- Ghép nối đúng API backend đã có, không mock
- Xử lý trạng thái (loading/error/empty/unauthorized) nhất quán
- Code sạch, dễ bảo trì, có thể dùng ngay để code

---

## 2. Vai trò người dùng

| Vai trò | Quyền chính |
|---|---|
| **admin** | Quản lý người dùng, quản lý học kỳ, quản lý sinh viên-lớp học phần |
| **giao_vu** | CRUD TKB, buổi học, lớp học phần, phân công, phòng, môn, khung giờ; gửi duyệt, công bố |
| **giang_vien** | Xem TKB cá nhân, khai báo lịch bận, gửi yêu cầu điều chỉnh |
| **sinh_vien** | Xem TKB cá nhân, xem thông báo |
| **truong_khoa** | Duyệt/từ chối TKB, duyệt yêu cầu điều chỉnh, xem báo cáo |

> **Lưu ý backend:** `nguoidung` có bảng `nguoidung_vai_tro` — 1 user có thể có nhiều vai_tro.
> Backend trả về `vai_tro` (role ưu tiên cao nhất, theo `thu_tu_uu_tien` ASC) và `vai_tros[]` (tất cả).
> Frontend hiện tại dùng `vai_tro` đơn lẻ để route — giữ nguyên.

---

## 3. Các entity chính (từ backend)

### 3.1. Mối quan hệ

```
nguoidung (user_id)
  ├── vai_tro: nhiều ← nguoidung_vai_tro → vai_tro_catalog
  ├── giangvien  (1:1, qua user_id)
  └── sinhvien   (1:1, qua user_id)

sinhvien
  └── lop_hanh_chinh (n:1)
        └── giao_vien_chu_nhiem → giangvien

thoi_khoa_bieu (tkb_id, duy nhất mỗi học kỳ)
  └── buoi_hoc (nhiều)
        ├── phan_cong_giang_day → lop_hoc_phan + giangvien
        ├── phong_hoc
        └── khung_thoi_gian

lop_hoc_phan
  ├── mon_hoc
  ├── hoc_ky
  └── phan_cong_giang_day (nhiều — 1 lớp HP có 1 giảng viên chính)

sinhvien_lophocphan  ← enrollment table
  └── sinhvien + lop_hoc_phan → quyết định TKB cá nhân sinh viên

khung_thoi_gian (26 rows cố định: thứ 2–CN × tiết 1–11)
  └── buoi_hoc (nhiều)

lich_ban_tuan / lich_ban_ngay
  └── giangvien + hoc_ky

yeu_cau_dieu_chinh
  └── buoi_hoc + giangvien (người gửi) + truong_khoa (người duyệt)
```

### 3.2. Entity ngắn gọn

| Entity | Mô tả |
|---|---|
| `nguoidung` | User cơ bản: họ tên, email, mật khẩu (bcrypt), trạng thái |
| `sinh_vien` | Sinh viên: mã SV, liên kết lớp hành chính |
| `giang_vien` | Giảng viên: mã GV, học vị, giới hạn tải giảng |
| `mon_hoc` | Môn học: mã, tên, số tín chỉ, số tiết |
| `lop_hoc_phan` | Lớp học phần: mã, tên, sĩ số tối đa, trạng thái |
| `phan_cong_giang_day` | Phân công: lớp HP + giảng viên + vai trò (chính/phụ) |
| `phong_hoc` | Phòng: mã, tên, sức chứa, loại (lý thuyết/thực hành/thi) |
| `khung_thoi_gian` | Khung giờ cố định: thứ (2–8) + tiết bắt đầu/kết thúc (1–11) + giờ |
| `buoi_hoc` | **Quan trọng nhất.** Buổi học đơn lẻ: liên kết TKB + phân công + phòng + khung giờ + ngày cụ thể + hình thức (LT/TH) |
| `thoi_khoa_bieu` | TKB tổng hợp: gắn với 1 học kỳ, trạng thái (`nhap`→`cho_phe_duyet`→`da_phe_duyet`→`da_cong_bo`) |
| `lich_ban_tuan / lich_ban_ngay` | Lịch bận của giảng viên theo khung giờ hoặc ngày cụ thể |
| `yeu_cau_dieu_chinh` | Yêu cầu điều chỉnh: loại (đổi phòng/GV/giờ/hủy), trạng thái (chờ/đồng ý/từ chối) |
| `thong_bao` + `thong_bao_nguoi_nhan` | Thông báo hệ thống, gửi theo đối tượng |
| `hoc_ky` | Học kỳ: tên, năm học, ngày bắt đầu/kết thúc |
| `rang_buoc_xep_lich` | Ràng buộc xếp lịch — **chỉ lưu, chưa enforce tự động** |

---

## 4. Các trang frontend

### 4.1. Trang chung

| Trang | Route | Mô tả |
|---|---|---|
| Login | `/login` | Đăng nhập email + mật khẩu, redirect theo vai_tro |
| Dashboard | `/dashboard` | Tổng quan, thống kê nhanh theo vai trò |

### 4.2. Sinh viên (`/sinh-vien/*`)

| Trang | Route | API | Mô tả |
|---|---|---|---|
| TKB cá nhân | `/sinh-vien/tkb-ca-nhan` | GET `/sinh-vien/tkb-ca-nhan?hoc_ky_id=` | Grid tuần, chế độ xem |
| Thông báo | `/sinh-vien/thong-bao` | GET `/sinh-vien/thong-bao`; PUT `/sinh-vien/thong-bao/:id/doc` | Danh sách thông báo, đánh dấu đã đọc |

### 4.3. Giảng viên (`/giang-vien/*`)

| Trang | Route | API | Mô tả |
|---|---|---|---|
| TKB cá nhân | `/giang-vien/tkb-ca-nhan` | GET `/giang-vien/tkb-ca-nhan?hoc_ky_id=` | Grid tuần, chế độ xem |
| Khai báo lịch bận | `/giang-vien/lich-ban` | GET `/giang-vien/lich-ban`; POST `/giang-vien/khai-bao-lich-ban` | Thêm lịch bận tuần/ngày |
| Gửi yêu cầu điều chỉnh | `/giang-vien/yeu-cau` | GET + POST `/giang-vien/yeu-cau-dieu-chinh` | Chọn buổi học, chọn loại yêu cầu, gửi |
| Thông báo | `/giang-vien/thong-bao` | GET `/giang-vien/thong-bao` | Xem thông báo |

### 4.4. Giáo vụ (`/giao-vu/*`)

| Trang | Route | API CRUD chính | Mô tả |
|---|---|---|---|
| TKB (grid builder) | `/giao-vu/tkb` | GET `/giao-vu/thoi-khoa-bieu`; POST/PUT/DELETE `/giao-vu/buoi-hoc` | Lưới TKB, click để sửa, nút thêm buổi học |
| Lớp học phần | `/giao-vu/lop-hoc-phan` | GET, POST `/giao-vu/lop-hoc-phan` | Thêm lớp HP **(backend chưa có PUT/DELETE — giả định)** |
| Phân công giảng dạy | `/giao-vu/phan-cong` | GET, POST `/giao-vu/phan-cong` | Phân công GV cho lớp HP |
| Giảng viên | `/giao-vu/giang-vien` | GET `/giao-vu/giang-vien` | Xem danh sách GV |
| SV – Lớp HP | `/giao-vu/sinh-vien-lhp` | GET, POST, DELETE `/admin/sinh-vien-lhp` | Gán sinh viên vào lớp HP |
| Phòng học | `/giao-vu/phong-hoc` | GET, POST `/giao-vu/phong-hoc` | Thêm phòng |
| Khung thời gian | `/giao-vu/khung-thoi-gian` | GET, POST `/giao-vu/khung-thoi-gian` | Khung giờ cố định |
| Lịch bận GV | `/giao-vu/lich-ban` | GET `/giao-vu/lich-ban`; PUT `/giao-vu/lich-ban/:id/duyet` | Duyệt lịch bận GV |
| Thông báo | `/giao-vu/thong-bao` | GET, POST `/giao-vu/thong-bao` | Tạo và gửi thông báo |
| Báo cáo | `/giao-vu/bao-cao` | GET `/giao-vu/bao-cao-phong?hoc_ky_id=` | Thống kê sử dụng phòng |
| **Gửi duyệt** | *(trên trang TKB)* | PUT `/giao-vu/gui-phe-duyet-tkb/:tkb_id` | Gửi TKB lên trưởng khoa |
| **Công bố** | *(trên trang TKB)* | PUT `/giao-vu/cong-bo-tkb/:tkb_id` | Công bố TKB đã duyệt |
| **Tạo TKB mới** | *(trên trang TKB)* | POST `/giao-vu/tao-tkb` | Tạo TKB cho học kỳ chưa có |

### 4.5. Trưởng khoa (`/truong-khoa/*`)

| Trang | Route | API | Mô tả |
|---|---|---|---|
| TKB | `/truong-khoa/tkb` | GET `/truong-khoa/thoi-khoa-bieu` | Xem TKB toàn khoa |
| Duyệt TKB | *(trên trang TKB)* | PUT `/truong-khoa/phe-duyet-tkb/:id`; PUT `/truong-khoa/tu-choi-tkb/:id` | Duyệt hoặc từ chối TKB |
| Duyệt yêu cầu | `/truong-khoa/yeu-cau` | GET `/truong-khoa/yeu-cau-dieu-chinh`; PUT `/truong-khoa/yeu-cau-dieu-chinh/:id/duyet` | Duyệt yêu cầu điều chỉnh |
| Báo cáo | `/truong-khoa/bao-cao` | GET `/truong-khoa/bao-cao?hoc_ky_id=` | Thống kê tổng quan |

### 4.6. Admin (`/admin/*`)

| Trang | Route | API | Mô tả |
|---|---|---|---|
| Người dùng | `/admin/nguoi-dung` | GET, POST `/admin/nguoi-dung`; PUT `/admin/nguoi-dung/:id/khoa`; DELETE `/admin/nguoi-dung/:id` | CRUD user + vai trò |
| Học kỳ | `/admin/hoc-ky` | GET, POST `/admin/hoc-ky` | Thêm học kỳ mới |
| SV – LHP | `/admin/sinh-vien-lhp` | GET, POST, DELETE `/admin/sinh-vien-lhp` | Gán sinh viên vào lớp HP |

---

## 5. Trang THỜI KHÓA BIỂU (QUAN TRỌNG NHẤT)

### 5.1. Cấu trúc lưới

```
Grid: 7 cột (Thứ 2 → Chủ nhật) × 11 hàng (tiết 1–11)

Row header:  "Tiết 1" ... "Tiết 11"
Col header:  "Thứ 2 (dd/MM)" ... "CN (dd/MM)"

Mỗi ô (thứ × tiết): chứa 0 hoặc N buổi học
```

**Mapping data → grid:**
```js
// buoi_hoc có trường thu_trong_tuan (từ khung_thoi_gian)
// và tiet_bat_dau
grid[thu_trong_tuan][tiet_bat_dau] = buoi_hoc
```

### 5.2. Mỗi ô hiển thị (buổi học card)

```
┌──────────────────────┐
│ 📍 P.301              │  ← phòng (tô màu nhạt theo loại phòng)
│ Nhập môn AI          │  ← tên môn (in đậm)
│ LHP: AI101-01        │  ← mã lớp học phần
│ GV: Nguyễn Văn A     │  ← giảng viên
│ 🕐 07:00 – 09:30      │  ← giờ học (từ khung_thoi_gian)
│ [LT] / [TH]          │  ← hình thức, badge màu
└──────────────────────┘
```

### 5.3. Các trạng thái hiển thị

| Vai trò | Chế độ | Hành vi |
|---|---|---|
| **Sinh viên / Giảng viên** | Xem (view) | Card chỉ hiển thị, không tương tác |
| **Trưởng khoa** | Xem (view) | Card hiển thị + nút Duyệt/Từ chối ở header TKB |
| **Giáo vụ** (`nhap` / `cho_phe_duyet`) | Builder (edit) | Click card → modal sửa; nút "Thêm buổi học" ở ô trống |
| **Giáo vụ** (`da_phe_duyet` / `da_cong_bo`) | Khóa | Tất cả nút sửa/xóa bị disable |

### 5.4. Badge trạng thái TKB (header)

| Trạng thái | Màu (Ant Design) | Icon |
|---|---|---|
| `nhap` | `default` (xám) | EditOutlined |
| `cho_phe_duyet` | `warning` (cam) | ClockCircleOutlined |
| `da_phe_duyet` | `processing` (xanh dương) | CheckCircleOutlined |
| `da_cong_bo` | `success` (xanh) | RocketOutlined |

### 5.5. Các nút hành động (giao vụ, trên trang TKB)

- **Tạo TKB** — chỉ hiện khi học kỳ chưa có TKB
- **Thêm Buổi Học** — disabled khi TKB đã `da_phe_duyet` trở lên
- **Gửi Duyệt** — disabled khi trạng thái ≠ `nhap`
- **Công Bố** — disabled khi trạng thái ≠ `da_phe_duyet`

### 5.6. Tính năng nâng cao (giả định — backend chưa hỗ trợ đầy đủ)

| Tính năng | Trạng thái backend | Hành động frontend |
|---|---|---|
| Tạo nhiều buổi cùng lúc (batch) | Chưa có API | Hiện tại gọi POST nhiều lần; UI có nút "Thêm nhanh 1 tuần" |
| Tự động kiểm tra xung đột khi thêm | DB trigger có | Hiện lỗi từ `error.response.data.error` |
| Lọc grid theo GV / lớp HP | Chưa có API filter | Giả định: thêm `?giang_vien_id=` / `?lop_hoc_phan_id=` |
| TKB nhiều phiên bản | Không hỗ trợ (1 TKB/học kỳ) | — |

---

## 6. API Integration

### 6.1. Auth

```
POST /api/auth/login
  Body:    { email, mat_khau }
  Response: { token, user: { user_id, ho_ten, email, vai_tro, vai_tros[],
                ma_gv?, giang_vien_id?, hoc_vi?, ma_sv?, sinh_vien_id? } }
  Frontend: lưu token + user vào localStorage; redirect theo vai_tro

GET /api/auth/me
  Header:  Authorization: Bearer <token>
  Frontend: dùng khi cần refresh thông tin user
```

### 6.2. Sinh viên

```
GET /api/sinh-vien/tkb-ca-nhan?hoc_ky_id=
  → buoi_hoc[] (đã join phan_cong, mon_hoc, phong_hoc, khung_thoi_gian)
  → Map: grid[thu_trong_tuan][tiet_bat_dau] = buoi_hoc

GET /api/sinh-vien/thong-bao
  → thong_bao[] cho user đang login

PUT /api/sinh-vien/thong-bao/:id/doc
  → đánh dấu đã đọc
```

### 6.3. Giảng viên

```
GET /api/giang-vien/tkb-ca-nhan?hoc_ky_id=
  → buoi_hoc[] (các buổi được phân công cho giang_vien_id trong token)

POST /api/giang-vien/khai-bao-lich-ban
  Body: { hoc_ky_id, khung_thoi_gian_id, ngay_cu_the?, ly_do }
  → Có ngay_cu_the → lich_ban_ngay; ngược lại → lich_ban_tuan
  → Backend tự phân biệt

POST /api/giang-vien/yeu-cau-dieu-chinh
  Body: { buoi_hoc_id, loai_yeu_cau_id, ly_do?, noi_dung_de_xuat? }
  → Gửi yêu cầu; trạng thái mặc định: 'cho_duyet'

GET /api/giang-vien/thong-bao
  → thong_bao[] cho giảng viên
```

### 6.4. Giáo vụ

```
POST /api/giao-vu/tao-tkb
  Body: { hoc_ky_id, ghi_chu? }
  → Tạo TKB mới; trạng thái: 'nhap'
  → Error nếu học kỳ đã có TKB

GET /api/giao-vu/thoi-khoa-bieu?hoc_ky_id=
  → buoi_hoc[] (tất cả buổi của TKB học kỳ)
  → Response có trường trang_thai TKB (cùng học kỳ)

POST /api/giao-vu/buoi-hoc
  Body: { tkb_id, phan_cong_id, phong_hoc_id, khung_thoi_gian_id,
          ngay_hoc, hinh_thuc?, ghi_chu? }
  → Tạo 1 buổi học; DB trigger chạy conflict check
  → Lỗi: error.response.data.error chứa message từ trigger

PUT /api/giao-vu/buoi-hoc/:id
  Body: { phong_hoc_id?, khung_thoi_gian_id?, ngay_hoc?, hinh_thuc?, ghi_chu? }
  → Cập nhật; re-check conflicts

DELETE /api/giao-vu/buoi-hoc/:id
  → Xóa mềm: trang_thai='huy' (không restore được)

PUT /api/giao-vu/gui-phe-duyet-tkb/:tkb_id
  → nhap → cho_phe_duyet

PUT /api/giao-vu/cong-bo-tkb/:tkb_id
  → da_phe_duyet → da_cong_bo
  → Tự động tạo thông báo gửi tất cả sinh viên + giảng viên

GET /api/giao-vu/hoc-ky
GET /api/giao-vu/phong-hoc
GET /api/giao-vu/khung-thoi-gian
GET /api/giao-vu/mon-hoc
GET /api/giao-vu/lop-hoc-phan?hoc_ky_id=
GET /api/giao-vu/phan-cong?hoc_ky_id=

POST /api/giao-vu/thong-bao
  Body: { tieu_de, noi_dung, loai_thong_bao?, doi_tuong, buoi_hoc_id? }
  → Tạo + batch insert thong_bao_nguoi_nhan theo doi_tuong
```

### 6.5. Trưởng khoa

```
GET /api/truong-khoa/thoi-khoa-bieu?hoc_ky_id=
  → buoi_hoc[] với thông tin trang_thai của TKB

PUT /api/truong-khoa/phe-duyet-tkb/:tkb_id
  → cho_phe_duyet → da_phe_duyet

PUT /api/truong-khoa/tu-choi-tkb/:tkb_id
  → cho_phe_duyet → nhap (quay về giao vụ sửa lại)
  → Không lưu lý do từ chối (backend chưa hỗ trợ)

GET /api/truong-khoa/yeu-cau-dieu-chinh?trang_thai=&page=&limit=
  → { data: yeu_cau[], pagination }

PUT /api/truong-khoa/yeu-cau-dieu-chinh/:id/duyet
  Body: { hanh_dong: "dong_y"|"tu_choi", noi_dung_phan_hoi? }
  → dong_y: trang_thai='da_duyet' + INSERT phan_hoi_yeu_cau
            + UPDATE buoi_hoc.ghi_chu += "[ĐIỀU CHỈNH]: ..."
  → tu_choi: trang_thai='tu_choi' + INSERT phan_hoi_yeu_cau

GET /api/truong-khoa/bao-cao?hoc_ky_id=
  → { so_giang_vien, so_lop_hoc_phan, so_phong_hoc, so_buoi_hoc }
```

### 6.6. Admin

```
GET /api/admin/nguoi-dung?vai_tro=&q=&page=&limit=
  → { data: nguoidung[], pagination }

POST /api/admin/nguoi-dung
  Body: { ho_ten, email, mat_khau, vai_tro, ma_gv?, hoc_vi?, ma_sv?, lop_hanh_chinh_id? }

PUT /api/admin/nguoi-dung/:id/khoa
  → toggle hoat_dong ↔ khoa (admin accounts protected)

DELETE /api/admin/nguoi-dung/:id
  → soft delete (admin accounts protected)

GET /api/admin/sinh-vien-lhp?lop_hoc_phan_id=
POST /api/admin/sinh-vien-lhp
  Body: { sinh_vien_id, lop_hoc_phan_id }
  → Kiểm tra si_so_toi_da, cho phép re-enroll sau khi drop

DELETE /api/admin/sinh-vien-lhp?sinh_vien_id=&lop_hoc_phan_id=
  → soft delete enrollment
```

---

## 7. Luồng nghiệp vụ chính

### Luồng 1: Tạo → Duyệt → Công bố TKB

```
Giáo Vụ
  ① Chọn học kỳ
  ② Tạo TKB (POST /tao-tkb) → trạng thái: 'nhap'
  ③ Thêm/sửa/xóa buổi học trên lưới
     → POST /buoi-hoc: conflict check (DB trigger)
     → PUT  /buoi-hoc/:id: re-check conflicts
     → DELETE /buoi-hoc/:id: xóa mềm
  ④ Gửi duyệt (PUT /gui-phe-duyet-tkb/:id) → trạng thái: 'cho_phe_duyet'

Trưởng Khoa
  ⑤ Xem TKB trên lưới, kiểm tra
  ⑥a Duyệt (PUT /phe-duyet-tkb/:id) → trạng thái: 'da_phe_duyet'
  ⑥b Từ chối (PUT /tu-choi-tkb/:id) → trạng thái: 'nhap' (giao vụ sửa lại)

Giáo Vụ (sau duyệt)
  ⑦ Công bố (PUT /cong-bo-tkb/:id) → trạng thái: 'da_cong_bo'
     → Backend tự tạo thông báo gửi sinh viên + giảng viên
```

### Luồng 2: Điều chỉnh lịch (giảng viên yêu cầu)

```
Giảng Viên
  ① Xem TKB cá nhân
  ② Click buổi học → Mở modal "Yêu cầu điều chỉnh"
  ③ Chọn loại: đổi phòng / đổi GV / đổi giờ / hủy
  ④ Nhập lý do, nội dung đề xuất
  ⑤ Gửi (POST /yeu-cau-dieu-chinh) → trạng thái: 'cho_duyet'

Trưởng Khoa
  ⑥ Xem danh sách yêu cầu chờ duyệt (/truong-khoa/yeu-cau)
  ⑦a Đồng ý
       → buoi_hoc.ghi_chu cập nhật "[ĐIỀU CHỈNH]: ..."
       → INSERT phan_hoi_yeu_cau
       → Giao vụ cập nhật buổi học thực tế (PUT /buoi-hoc/:id)
       → Gửi thông báo cho sinh viên (POST /thong-bao)
  ⑦b Từ chối → trạng thái: 'tu_choi'
```

### Luồng 3: Sinh viên xem TKB

```
Sinh Viên
  ① Chọn học kỳ (ưu tiên học kỳ đang hoạt động)
  ② GET /sinh-vien/tkb-ca-nhan?hoc_ky_id=
  ③ Map buoi_hoc[] → grid[thu_trong_tuan][tiet_bat_dau]
  ④ Hiển thị lưới TKB tuần với navigation tuần
```

### Luồng 4: Giáo vụ quản lý lớp học phần

```
Giáo Vụ
  ① Tạo lớp HP (POST /lop-hoc-phan): mon_hoc + hoc_ky + mã
  ② Phân công GV (POST /phan-cong): lớp HP + giảng viên + vai trò (chính)
  ③ Gán sinh viên (POST /sinh-vien-lhp): sinh viên + lớp HP
  ④ Thêm buổi học (POST /buoi-hoc): phân công + phòng + khung giờ + ngày
     → Trigger kiểm tra: trùng lịch GV, lịch bận, sức chứa phòng, sĩ số
```

---

## 8. Auth Flow

```
1. App mount → kiểm tra localStorage có 'token' + 'user' không
   ├── Có → hydrate AuthContext → vào dashboard
   └── Không → redirect /login

2. Login: POST /api/auth/login
   ├── Lưu token vào localStorage
   ├── Lưu user (JSON) vào localStorage
   └── Redirect theo user.vai_tro
        admin      → /admin
        giao_vu    → /giao-vu
        giang_vien  → /giang-vien
        sinh_vien   → /sinh-vien
        truong_khoa → /truong-khoa
        default     → /dashboard

3. Mỗi request API:
   api.interceptors.request.use
     → đọc token từ localStorage
     → gắn Authorization: Bearer <token>

4. Mỗi response:
   ├── 2xx → trả kết quả bình thường
   ├── 401 / 403 → xóa token + user, window.location.href = '/login'
   └── 4xx / 5xx → reject; component xử lý hiển thị lỗi

5. Logout: xóa localStorage, setUser(null), redirect /login
```

> **Lưu ý:** Backend không có refresh token. JWT hết hạn 24h → user phải đăng nhập lại.

---

## 9. State Handling

| Trạng thái | Cách xử lý |
|---|---|
| **Loading** | `<Spin spinning={loading}>` hoặc `loading={loading}` prop của Ant Design |
| **Error** | `message.error(error.response?.data?.error)` cho API fail; `<Empty description="Lỗi tải dữ liệu" />` khi fetch thất bại |
| **Empty** | `<Empty description="Chưa có dữ liệu" />` — đặc biệt trên lưới TKB khi `data.length === 0` |
| **Unauthorized** | api interceptor tự động redirect /login; component không cần xử lý thủ công |

### Quy tắc chi tiết theo loại component

| Component | Loading | Error | Empty |
|---|---|---|---|
| **Lưới TKB** | `<Spin spinning={loading}>` bao quanh `<table>` | `message.error()` + `<Empty description="Lỗi tải TKB" />` | `<Empty description="Chưa có buổi học nào" />` |
| **Danh sách (Table)** | `loading={loading}` prop của `<Table>` | `message.error()` + ẩn table | Ant Design `<Table>` tự xử lý |
| **Form submit** | `loading={submitting}` trên Button; disable toàn form | `message.error()` | — |
| **Select dropdown** | Ant Design Select tự hiển thị "Đang tải..." | fallback về empty options | "Không có dữ liệu" |

---

## 10. Giới hạn hiện tại của backend

### 10.1. Ràng buộc chưa enforce hoàn toàn

| Ràng buộc | Tình trạng |
|---|---|
| `rang_buoc_xep_lich` | Chỉ lưu trữ trong DB, không tự động kiểm tra khi thêm/sửa buổi học |
| `gioi_han_tai_giang` | Check app-level ở POST/PUT buổi học, **KHÔNG check** khi DELETE |
| Sức chứa phòng | Chỉ check khi INSERT buổi học mới, không re-check khi UPDATE phòng |

### 10.2. Pagination chưa đầy đủ

| Endpoint | Vấn đề |
|---|---|
| `GET /giao-vu/thoi-khoa-bieu` | Không có pagination (hard-limit 500) |
| `GET /sinh-vien/tkb-ca-nhan` | Không có pagination |
| `GET /giang-vien/tkb-ca-nhan` | Có limit/offset nhưng join đầy đủ thông tin chưa rõ **(giả định)** |
| `GET /truong-khoa/yeu-cau-dieu-chinh` | Có pagination ✅ |

### 10.3. CRUD chưa đầy đủ

| Object | CRUD hiện có | Thiếu |
|---|---|---|
| `phan_cong_giang_day` | GET, POST | PUT, DELETE |
| `lop_hoc_phan` | GET, POST | PUT, DELETE |
| `phong_hoc` | GET, POST | PUT, DELETE |
| `mon_hoc` | GET, POST | PUT, DELETE |
| `khung_thoi_gian` | GET, POST | PUT, DELETE |
| `lich_ban_tuan / lich_ban_ngay` | GET, POST | DELETE |
| `yeu_cau_dieu_chinh` | GET, POST | PUT (sửa), DELETE (hủy) |
| `thoi_khoa_bieu` | GET, POST (tạo mới) | Không sửa trạng thái trực tiếp (chỉ qua flow duyệt) |

### 10.4. Các thiếu sót khác cần lưu ý

- **Không có refresh token** — JWT hết hạn 24h → user phải đăng nhập lại
- **Không có endpoint batch** — 1 buổi = 1 POST
- **Không có endpoint khôi phục** buổi học đã hủy (`trang_thai='huy'`)
- **Không lưu lý do từ chối TKB** — `tu-choi-tkb` không có body
- **Thông báo in-app only** — không có email/SMS
- **Không có rate limiting**
- **Multi-role user**: backend hỗ trợ nhưng frontend chưa xử lý routing đa vai_tro

---

## 11. Kiến trúc Frontend đề xuất

### 11.1. Tech stack

| Thư viện | Vai trò | Trạng thái hiện tại |
|---|---|---|
| **React 18** | UI framework | ✅ Đã dùng (JS) |
| **TypeScript** | Type safety | ❌ Chưa dùng — cần migrate dần |
| **Vite** | Build tool | ✅ Đã dùng |
| **React Router v6** | Routing | ✅ Đã dùng |
| **Ant Design 5** | Component library | ✅ Đã dùng |
| **Axios** | HTTP client | ✅ Đã dùng |
| **dayjs** | Date handling | ✅ Đã dùng |
| **TanStack Query** | Server state, cache | ❌ Chưa dùng — **cần thêm** |

### 11.2. Cấu trúc folder

```
src/
├── api/                        # Cấu hình axios + hàm gọi API theo domain
│   ├── client.js              # axios instance (baseURL, interceptors, 401 handler)
│   ├── auth.js                 # login, me
│   ├── sinhVien.js             # tkbCaNhan, thongBao
│   ├── giangVien.js            # tkbCaNhan, khaiBaoLichBan, yeuCau
│   ├── giaoVu.js               # tkb, buoiHoc, lopHocPhan, phanCong, ...
│   ├── truongKhoa.js           # pheDuyetTKB, duyetYeuCau, ...
│   └── admin.js               # nguoiDung, hocKy, sinhVienLHP
│
├── features/                   # Feature-based modules
│   ├── auth/
│   │   └── LoginPage.jsx
│   ├── tkb/
│   │   ├── TKBGrid.jsx              # Component lưới TKB (dùng chung mọi vai trò)
│   │   ├── TKBGridCell.jsx          # Ô (thứ × tiết) trong lưới
│   │   ├── BuoiHocCard.jsx          # Card buổi học trong ô
│   │   ├── BuoiHocModal.jsx         # Modal thêm/sửa buổi học
│   │   ├── TKBStatusBadge.jsx       # Badge trạng thái TKB
│   │   ├── TKBActionBar.jsx         # Thanh hành động (Gửi duyệt, Công bố)
│   │   └── useTKB.js                 # React Query hook cho TKB
│   ├── thong-bao/
│   │   ├── ThongBaoList.jsx
│   │   └── useThongBao.js
│   ├── lich-ban/
│   │   ├── LichBanForm.jsx
│   │   └── useLichBan.js
│   └── yeu-cau/
│       ├── YeuCauList.jsx
│       ├── YeuCauModal.jsx
│       └── useYeuCau.js
│
├── components/                 # Shared components
│   ├── layouts/
│   │   ├── MainLayout.jsx           # Layout chung (sidebar + header, có logout)
│   │   ├── GiaoVuLayout.jsx
│   │   ├── GiangVienLayout.jsx
│   │   ├── SinhVienLayout.jsx
│   │   ├── TruongKhoaLayout.jsx
│   │   └── AdminLayout.jsx
│   ├── common/
│   │   ├── PageHeader.jsx            # Tiêu đề trang chuẩn
│   │   ├── FilterBar.jsx             # Thanh lọc học kỳ + tuần
│   │   ├── StatusBadge.jsx           # Badge trạng thái đa năng
│   │   └── ConfirmModal.jsx         # Modal xác nhận
│   └── hoc-ky/
│       └── HocKySelect.jsx          # Select học kỳ, tự chọn học kỳ hoạt động
│
├── pages/                      # Pages — ghép feature + layout
│   ├── DashboardPage.jsx
│   ├── LoginPage.jsx
│   ├── giao-vu/               # Giữ nguyên cấu trúc hiện tại
│   ├── giang-vien/
│   ├── sinh-vien/
│   ├── truong-khoa/
│   └── admin/
│
├── context/
│   └── AuthContext.jsx         # Đã có — giữ nguyên
│
├── hooks/                      # Shared hooks
│   ├── useServerState.js       # Wrapper React Query (loading/error/data)
│   └── useDisclosure.js        # Modal open/close toggle
│
├── utils/                      # Utility functions
│   ├── tkbGrid.js             # buildGrid(buoiHoc[], thuList, tietList)
│   ├── dateUtils.js           # dayjs helpers (format date, week range)
│   └── formatters.js          # Format display (tiết, giờ, trạng thái)
│
├── App.jsx                     # Router + ProtectedRoute (giữ nguyên cấu trúc)
└── main.jsx                    # React DOM + AuthProvider + Router
```

### 11.3. API layer pattern (mẫu)

```js
// src/api/client.js
import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;

// src/api/giaoVu.js
import client from './client';

export const giaoVu = {
  getThoiKhoaBieu: (hocKyId) =>
    client.get('/giao-vu/thoi-khoa-bieu', { params: { hoc_ky_id: hocKyId } })
      .then(r => r.data),

  createBuoiHoc: (data) =>
    client.post('/giao-vu/buoi-hoc', data).then(r => r.data),

  updateBuoiHoc: (id, data) =>
    client.put(`/giao-vu/buoi-hoc/${id}`, data).then(r => r.data),

  deleteBuoiHoc: (id) =>
    client.delete(`/giao-vu/buoi-hoc/${id}`).then(r => r.data),

  guiPheDuyet: (tkbId) =>
    client.put(`/giao-vu/gui-phe-duyet-tkb/${tkbId}`).then(r => r.data),

  congBo: (tkbId) =>
    client.put(`/giao-vu/cong-bo-tkb/${tkbId}`).then(r => r.data),

  // ... các hàm khác
};
```

### 11.4. React Query — pattern đề xuất

```js
// src/features/tkb/useTKB.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { giaoVu } from '../../api/giaoVu';

export const useTKB = (hocKyId) => useQuery({
  queryKey: ['tkb', hocKyId],
  queryFn: () => giaoVu.getThoiKhoaBieu(hocKyId),
  enabled: !!hocKyId,
  staleTime: 5 * 60 * 1000,  // 5 phút
});

export const useCreateBuoiHoc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: giaoVu.createBuoiHoc,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tkb'] }),
  });
};
```

### 11.5. Component lưới TKB dùng chung

```jsx
// src/features/tkb/TKBGrid.jsx
// Props: buoiHoc[], mode: 'view' | 'edit', onCellClick?, onAddCell?

const TKBGrid = ({ buoiHoc, mode, onCellClick, onAddCell }) => {
  const grid = buildGrid(buoiHoc, THUS, TIETS);
  // render 11 rows × 7 cols
  // mode='view': mỗi cell chỉ hiển thị card
  // mode='edit': cell trống có nút + ; card click → mở modal sửa
};
```

### 11.6. File ưu tiên thêm/sửa trước khi code

| Ưu tiên | File | Lý do |
|---|---|---|
| **1** | `src/api/client.js` | Tách axios instance, chuẩn hóa error handling |
| **2** | `src/utils/tkbGrid.js` | Hàm `buildGrid()` — dùng chung mọi vai trò |
| **3** | `src/components/hoc-ky/HocKySelect.jsx` | Select học kỳ chuẩn, tự chọn `hoat_dong` mặc định |
| **4** | `src/features/tkb/TKBGrid.jsx` | Component lưới có 2 mode, thay thế logic trùng lặp |
| **5** | `src/components/layouts/MainLayout.jsx` | Sidebar + header chuẩn, highlight active menu |

### 11.7. Migrate dần sang TypeScript (thứ tự ưu tiên)

1. Types cho entity (buoi_hoc, lop_hoc_phan, mon_hoc, phong_hoc, khung_thoi_gian)
2. Types cho API response/payload
3. Type cho AuthContext (user shape)
4. Props typing cho shared components

---

## 12. UI Inspiration (tham khảo từ demo)

> Nguồn: 2 ảnh demo trường ĐH Thăng Long — chỉ dùng làm reference cho style, không clone pixel-perfect.
> Màu sắc, bố cục, thành phần được điều chỉnh phù hợp backend và nghiệp vụ thực tế.

### 12.1. Login Page (`/login`)

```
┌──────────────────────────────────────────────────────────┐
│  🔴 HEADER BAR: nền #C63633 (đỏ sẫm), toàn bộ chiều rộng │
│  Trái: logo/trường đại học (text)                        │
│  Phải: icon ngôn ngữ / thông báo / user                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              ┌─────────────────────┐                      │
│              │  [Logo/Icon]        │                      │
│              │  HỆ THỐNG QUẢN LÝ  │                      │
│              │  Thời Khóa Biểu     │                      │
│              │  Khoa CNTT          │                      │
│              │                     │                      │
│              │  Tên đăng nhập      │  ← Input, nền trắng │
│              │  Mật khẩu          │  ← Input, nền trắng  │
│              │                     │                      │
│              │  [Đăng nhập]        │  ← Button #C63633   │
│              └─────────────────────┘                      │
│                                                          │
│  Footer: copyright, link hỗ trợ                          │
└──────────────────────────────────────────────────────────┘
```

**Chi tiết:**
- Header bar cố định (sticky), nền `#C63633`, chữ trắng
- Card đăng nhập: nền trắng, shadow nhẹ, bo góc, canh giữa màn hình
- Input: viền xám, focus viền đỏ `#C63633`
- Button đăng nhập: nền `#C63633`, chữ trắng, bo góc 4px, cao ~44px
- Placeholder: "Tên đăng nhập" / "Mật khẩu"
- Validation: message đỏ bên dưới input (required)
- Error: `message.error()` từ Ant Design khi login fail

### 12.2. Main Layout (Header + Content)

```
┌──────────────────────────────────────────────────────────┐
│  🔴 HEADER BAR: #C63633, sticky                          │
│  Trái: [Logo] + "TRƯỜNG ĐẠI HỌC THĂNG LONG" / "HỆ      │
│        THỐNG QUẢN LÝ TKB - KHOA CNTT"                  │
│  Phải: [🔔 Thông báo] [👤 User dropdown → Đăng xuất]    │
├──────────────────────────────────────────────────────────┤
│  Nội dung chính:                                         │
│  - padding: 24px                                        │
│  - background: #f5f5f5 (xám nhạt)                       │
│  - max-width: 1400px, margin: auto                       │
└──────────────────────────────────────────────────────────┘
```

**Header bar details:**
- Chiều cao: 56–64px
- Logo bên trái (text thường hoặc SVG đơn giản)
- Right section: icon chuông (thông báo chưa đọc badge count) + user avatar/name dropdown
- User dropdown: họ tên, vai trò, "Đăng xuất"
- Sticky header (không cuộn theo trang)

### 12.3. Trang TKB — Chi tiết bố cục

```
┌──────────────────────────────────────────────────────────┐
│  [← Back? nếu cần]                                      │
│  🔴 Tiêu đề: "THỜI KHÓA BIỂU" (đỏ, font lớn)           │
│  [Badge trạng thái TKB]                                 │
├──────────────────────────────────────────────────────────┤
│  [Tabs]                                                  │
│  ┌─────────────┐ ┌──────────────────┐                   │
│  │ TKB TUẦN ● │ │ TKB THỨ - TIẾT   │                   │
│  └─────────────┘ └──────────────────┘                   │
│                                                          │
│  [Filter bar]                                            │
│  Năm học: [2025-2026 ▼]                                 │
│  Học kỳ:   [Học kỳ 2 ▼]                                │
│  Tuần:     [13/04/2026-19/04/2026 ▼]  [◀] [⬜] [▶]      │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │       │ Thứ 2      │ Thứ 3    │ ... │ CN          │ │
│  │       │ 13/04      │ 14/04    │     │ 19/04       │ │
│  │ Tiết  │            │          │     │             │ │
│  │  1    │  buổi học  │          │     │             │ │
│  │  2    │  (card)    │          │     │             │ │
│  │  3    │            │          │     │             │ │
│  │ ...   │            │          │     │             │ │
│  │  11   │            │          │     │             │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 12.4. Buổi học Card (trong ô lưới)

Dựa trên ảnh demo, mỗi card hiển thị đầy đủ:

```
┌────────────────────────────────────┐
│ 📍 P.301           ← phòng (đỏ đậm, đầu card)
│ Công nghệ Blockchain   ← tên môn (đỏ)
│ (IS430)                  ← mã môn (xám)
│ ──────────────────────────────── │
│ LHP: 252IS43004          ← xanh dương
│ Số tiết: 3              ← xanh dương
│ Tiết: 4-6               ← xanh dương
│ Giờ bắt đầu: 09g50      ← xanh dương (09g50 format)
│ GV: Trần Quang Duy      ← xanh dương
│ Email: 500294@...        ← xanh dương, nhỏ
│ ──────────────────────────────── │
│ Nội dung:               ← đỏ
└────────────────────────────────────┘
```

**Color palette cho card (theo demo):**
| Trường | Màu | Font weight |
|---|---|---|
| Phòng | `#C63633` (đỏ đậm) | bold |
| Tên môn | `#C63633` (đỏ đậm) | bold |
| Mã môn | `#999` (xám) | normal |
| LHP, Số tiết, Tiết, Giờ, GV, Email | `#1a4ca0` (xanh dương) | normal |
| Nội dung label | `#C63633` | normal |
| Border ngang | `#e0e0e0` | — |

**Card còn lại trong ảnh demo (không có GV — do BO MON tự xếp):**
```
│ BOMON (xám, bo góc nhỏ hơn, font nhỏ)                │
│ KLTN ngành Công nghệ thông tin (I1499)  ← đỏ          │
│ ... các trường info bình thường, GV/Email trống       │
```

> **Lưu ý:** Ảnh demo không có cột `so_tin_chi`, `hinh_thuc` (LT/TH). Backend có `hinh_thuc` nhưng ảnh demo không hiện. Nếu backend trả về → hiển thị thêm badge `[LT]` / `[TH]` ở đầu card (màu phân biệt: xanh lá = TH, cam = LT).

### 12.5. Bảng lưới TKB

```
Header hàng (cột đầu tiên):
  - Nền: #fafafa
  - Font: bold, 12px, màu #333
  - Canh giữa

Header cột (Thứ 2 → CN):
  - Nền: #C63633 (đỏ sẫm)
  - Chữ: trắng, font bold
  - Dòng 1: Thứ 2 / Thứ 3 / ...
  - Dòng 2: ngày dd/MM

Ô trống (không có buổi học):
  - Nền: trắng
  - Hover: #f5f5f5 (xám rất nhạt)

Border:
  - Grid lines: 1px solid #d9d9d9 (xám nhạt)
  - Corner/header: border-bottom đỏ 2px

Row height:
  - Cột "Tiết": cố định 60px
  - Các ô: min-height 60px, tự giãn theo nội dung card
```

### 12.6. Filter Bar chi tiết

```
[Năm học ▼]   ← Select, width: 160px
[Học kỳ ▼]    ← Select, width: 160px
[Tuần ▼]      ← DatePicker.RangePicker, format DD/MM/YYYY, width: 220px

[◀]           ← Button icon, nền #C63633, chữ trắng
[⬜ Hiện tại]  ← Button, nền trắng, viền đỏ
[▶]           ← Button icon, nền #C63633, chữ trắng
```

**Navigation tuần (◀ ▶):**
- ◀ ▶: icon mũi tên Ant Design, `type="primary"`, `background="#C63633"`
- "Hiện tại": quay về tuần hiện tại (dùng `dayjs().startOf('week').add(1,'day')`)
- RangePicker: cho phép chọn tuần bất kỳ; khi chọn → cập nhật header cột

### 12.7. CSS Variables đề xuất

```css
:root {
  /* Brand colors (từ demo) */
  --color-primary:       #C63633;   /* Đỏ sẫm — header, button, accent */
  --color-primary-dark:  #9e2a27;   /* Hover state */
  --color-primary-light: #fdf0ef;   /* Nền nhạt highlight */

  /* Text */
  --color-text-heading:  #C63633;   /* Tiêu đề mục, tên môn, phòng */
  --color-text-info:     #1a4ca0;   /* Thông tin phụ: LHP, GV, tiết... */
  --color-text-muted:    #999999;   /* Mã môn phụ, placeholder */
  --color-text-body:     #333333;   /* Body text */

  /* Grid */
  --color-border:        #d9d9d9;   /* Border lưới */
  --color-header-bg:     #C63633;   /* Header cột lưới */
  --color-row-bg:        #fafafa;   /* Nền cột tiết */

  /* Status */
  --color-success:       #52c41a;
  --color-warning:       #faad14;
  --color-error:         #ff4d4f;

  /* Spacing */
  --page-padding:        24px;
  --card-radius:          8px;
  --card-shadow:          0 2px 8px rgba(0,0,0,0.1);
}
```

---

## 13. Checklist trước khi bắt đầu code từng trang

- [ ] Kiểm tra API endpoint có tồn tại không (so sánh với danh sách ở mục 6)
- [ ] Kiểm tra response shape thực tế từ backend (Swagger nếu có)
- [ ] Xác định 3 trạng thái: loading / error / empty
- [ ] Kiểm tra vai trò nào được phép truy cập (`allowedRoles` trong `ProtectedRoute`)
- [ ] Xác định ràng buộc backend (validation, conflict check từ DB trigger)
- [ ] Field nào backend trả về thiếu → đánh dấu "giả định" trong code
- [ ] Dùng lại component chung (`HocKySelect`, `TKBGrid`) thay vì viết lại
