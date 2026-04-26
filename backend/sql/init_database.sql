-- ============================================
-- CƠ SỞ DỮ LIỆU: TKB_KHOA_CNTT
-- Phiên bản: 4.0 (Final)
-- ============================================
-- FILE: SCHEMA — chỉ tạo bảng, trigger, index
-- HƯỚNG DẪN:
--  1. pgAdmin4 → Chuột phải Databases → Create → Database → "tkb_khoa_cntt" → Save
--  2. Chuột phải tkb_khoa_cntt → Query Tool
--  3. Chạy FILE NÀY trước
--  4. Sau đó chạy seed_data.sql để nạp dữ liệu mẫu
-- LƯU Ý:
--  File này dùng CREATE TABLE thường — KHÔNG idempotent.
--  Re-run sẽ LỖI nếu bảng đã tồn tại.
--  Muốn reset hoàn toàn → DROP DATABASE tkb_khoa_cntt CASCADE + re-run cả 2.
--  Muốn re-run schema mà giữ data → tự viết ALTER thủ công.
--
-- SƠ ĐỒ PHỤ THUỘC BẢNG (thứ tự tạo quan trọng khi đọc/cập nhật):
--  Nhóm 1: nguoidung → nguoidung_vai_tro (vai_tro_catalog)
--  Nhóm 2: nguoidung → giangvien, sinhvien
--           nguoidung → lop_hanh_chinh → sinhvien
--  Nhóm 3: hoc_ky, mon_hoc  (không phụ thuộc)
--  Nhóm 4: khung_thoi_gian  (không phụ thuộc)
--  Nhóm 5: lop_hoc_phan → hoc_ky, mon_hoc
--           phan_cong_giang_day → lop_hoc_phan, giangvien
--  Nhóm 6-7: rang_buoc_xep_lich → hoc_ky
--             lich_ban_tuan/ngay → giangvien, hoc_ky, khung_thoi_gian
--  Nhóm 8: phong_hoc  (không phụ thuộc)
--  Nhóm 9: thoi_khoa_bieu → hoc_ky, nguoidung
--  Nhóm 10: buoi_hoc → tkb, phan_cong, phong, khung_thoi_gian
--  Nhóm 11: yeu_cau_dieu_chinh → buoi_hoc, giangvien, nguoidung
--            phan_hoi_yeu_cau → yeu_cau, nguoidung, hanh_dong_catalog
--  Nhóm 12: lich_su_cap_nhat → buoi_hoc, nguoidung, hanh_dong_catalog
--  Nhóm 13: thong_bao → buoi_hoc, nguoidung
--            thong_bao_nguoi_nhan → thong_bao, nguoidung
--  Nhóm 14: sinhvien_lophocphan → sinhvien, lop_hoc_phan
--            log_phan_lop → sinhvien_lophocphan, nguoidung, hanh_dong_catalog
-- ============================================

-- ============================================
-- NHÓM 1: NGƯỜI DÙNG & PHÂN QUYỀN
-- ============================================

CREATE TABLE nguoidung (
    user_id SERIAL PRIMARY KEY,
    ho_ten VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    mat_khau VARCHAR(255) NOT NULL,
    trang_thai VARCHAR(20) DEFAULT 'hoat_dong'
        CHECK (trang_thai IN ('hoat_dong', 'khoa'))
);

CREATE TABLE vai_tro_catalog (
    vai_tro_id SERIAL PRIMARY KEY,
    ten_vai_tro VARCHAR(50) UNIQUE NOT NULL,
    thu_tu_uu_tien INT DEFAULT 999,
    mo_ta VARCHAR(200)
);

CREATE TABLE nguoidung_vai_tro (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES nguoidung(user_id) ON DELETE CASCADE,
    vai_tro_id INT NOT NULL REFERENCES vai_tro_catalog(vai_tro_id) ON DELETE CASCADE,
    ngay_gan TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, vai_tro_id)
);

CREATE TABLE token_revocation (
    token_jti VARCHAR(64) PRIMARY KEY,
    user_id INT REFERENCES nguoidung(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_revocation_expires_at ON token_revocation(expires_at);

-- ============================================
-- NHÓM 2: GIẢNG VIÊN & SINH VIÊN
-- ============================================

CREATE TABLE giangvien (
    giang_vien_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES nguoidung(user_id) ON DELETE CASCADE,
    ma_gv VARCHAR(20) NOT NULL UNIQUE,
    hoc_vi VARCHAR(50),
    gioi_han_tai_giang INT DEFAULT 0 CHECK (gioi_han_tai_giang >= 0)
);

CREATE TABLE lop_hanh_chinh (
    lop_hanh_chinh_id SERIAL PRIMARY KEY,
    ma_lop VARCHAR(20) UNIQUE NOT NULL,
    ten_lop VARCHAR(100) NOT NULL,
    khoa VARCHAR(50),
    nam_nhap_hoc INT CHECK (nam_nhap_hoc > 0),
    giao_vien_chu_nhiem_id INT REFERENCES giangvien(giang_vien_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE sinhvien (
    sinh_vien_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES nguoidung(user_id) ON DELETE CASCADE,
    ma_sv VARCHAR(20) NOT NULL UNIQUE,
    lop_hanh_chinh_id INT REFERENCES lop_hanh_chinh(lop_hanh_chinh_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================
-- NHÓM 3: HỌC KỲ & MÔN HỌC
-- ============================================

CREATE TABLE hoc_ky (
    hoc_ky_id SERIAL PRIMARY KEY,
    ten_hoc_ky VARCHAR(50) NOT NULL,
    nam_hoc VARCHAR(20) NOT NULL,
    ngay_bat_dau DATE,
    ngay_ket_thuc DATE,
    trang_thai VARCHAR(20) DEFAULT 'hoat_dong'
        CHECK (trang_thai IN ('hoat_dong', 'ket_thuc')),
    CHECK (ngay_bat_dau IS NULL OR ngay_ket_thuc IS NULL OR ngay_bat_dau <= ngay_ket_thuc),
    UNIQUE (nam_hoc, ten_hoc_ky)
);

CREATE TABLE mon_hoc (
    mon_hoc_id SERIAL PRIMARY KEY,
    ma_mon VARCHAR(20) UNIQUE NOT NULL,
    ten_mon VARCHAR(100) NOT NULL,
    so_tin_chi INT CHECK (so_tin_chi > 0),
    so_tiet INT CHECK (so_tiet > 0)
);

CREATE TABLE lop_hoc_phan (
    lop_hoc_phan_id SERIAL PRIMARY KEY,
    mon_hoc_id INT REFERENCES mon_hoc(mon_hoc_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    hoc_ky_id INT NOT NULL REFERENCES hoc_ky(hoc_ky_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ma_lop_hp VARCHAR(20) UNIQUE NOT NULL,
    ten_lop_hp VARCHAR(100),
    si_so_toi_da INT DEFAULT 50 CHECK (si_so_toi_da > 0),
    trang_thai VARCHAR(20) DEFAULT 'hoat_dong'
        CHECK (trang_thai IN ('hoat_dong', 'tam_dung', 'ket_thuc'))
);

-- ============================================
-- NHÓM 4: KHUNG THỜI GIAN
-- ============================================

CREATE TABLE khung_thoi_gian (
    khung_thoi_gian_id SERIAL PRIMARY KEY,
    thu_trong_tuan INT NOT NULL CHECK (thu_trong_tuan BETWEEN 2 AND 8),
    tiet_bat_dau INT NOT NULL CHECK (tiet_bat_dau BETWEEN 1 AND 11),
    tiet_ket_thuc INT NOT NULL CHECK (tiet_ket_thuc BETWEEN 1 AND 11),
    gio_bat_dau TIME,
    gio_ket_thuc TIME,
    mo_ta VARCHAR(50),
    CHECK (tiet_ket_thuc >= tiet_bat_dau),
    CHECK (gio_ket_thuc IS NULL OR gio_bat_dau IS NULL OR gio_ket_thuc > gio_bat_dau),
    UNIQUE (thu_trong_tuan, tiet_bat_dau, tiet_ket_thuc)
);

-- ============================================
-- NHÓM 5: PHÂN CÔNG GIẢNG DẠY
-- hoc_ky_id: BỎ - derive từ lop_hoc_phan.hoc_ky_id
-- ============================================

CREATE TABLE phan_cong_giang_day (
    phan_cong_id SERIAL PRIMARY KEY,
    lop_hoc_phan_id INT NOT NULL REFERENCES lop_hoc_phan(lop_hoc_phan_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    giang_vien_id INT NOT NULL REFERENCES giangvien(giang_vien_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    vai_tro_phu_trach VARCHAR(20) DEFAULT 'chinh'
        CHECK (vai_tro_phu_trach IN ('chinh')),
    ngay_phan_cong TIMESTAMP DEFAULT NOW(),
    ghi_chu TEXT,
    UNIQUE (lop_hoc_phan_id, giang_vien_id),
    -- Chỉ 1 GV làm "chính" cho mỗi lớp học phần
    UNIQUE (lop_hoc_phan_id)
);

-- ============================================
-- NHÓM 6: RÀNG BUỘC XẾP LỊCH
-- ============================================

CREATE TABLE rang_buoc_xep_lich (
    rang_buoc_id SERIAL PRIMARY KEY,
    hoc_ky_id INT REFERENCES hoc_ky(hoc_ky_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ten_rang_buoc VARCHAR(100),
    loai_rang_buoc VARCHAR(30)
        CHECK (loai_rang_buoc IN ('gioi_han', 'uu_tien', 'trung_lich', 'phong_ban', 'khac')),
    muc_uu_tien INT DEFAULT 1 CHECK (muc_uu_tien >= 0),
    mo_ta TEXT,
    trang_thai VARCHAR(20) DEFAULT 'hoat_dong'
        CHECK (trang_thai IN ('hoat_dong', 'tam_dung', 'huy'))
);

-- ============================================
-- NHÓM 7: LỊCH BẬN GIẢNG VIÊN
-- ============================================

CREATE TABLE lich_ban_tuan (
    lich_ban_tuan_id SERIAL PRIMARY KEY,
    giang_vien_id INT NOT NULL REFERENCES giangvien(giang_vien_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    hoc_ky_id INT REFERENCES hoc_ky(hoc_ky_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    khung_thoi_gian_id INT REFERENCES khung_thoi_gian(khung_thoi_gian_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ly_do VARCHAR(200),
    trang_thai VARCHAR(20) DEFAULT 'cho_duyet'
        CHECK (trang_thai IN ('cho_duyet', 'dong_y', 'tu_choi'))
);

CREATE TABLE lich_ban_ngay (
    lich_ban_ngay_id SERIAL PRIMARY KEY,
    giang_vien_id INT NOT NULL REFERENCES giangvien(giang_vien_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    hoc_ky_id INT REFERENCES hoc_ky(hoc_ky_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    khung_thoi_gian_id INT REFERENCES khung_thoi_gian(khung_thoi_gian_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ngay_cu_the DATE NOT NULL,
    ly_do TEXT,
    trang_thai VARCHAR(20) DEFAULT 'cho_duyet'
        CHECK (trang_thai IN ('cho_duyet', 'dong_y', 'tu_choi'))
);

-- ============================================
-- NHÓM 8: PHÒNG HỌC
-- ============================================

CREATE TABLE phong_hoc (
    phong_hoc_id SERIAL PRIMARY KEY,
    ma_phong VARCHAR(20) UNIQUE NOT NULL,
    ten_phong VARCHAR(50) NOT NULL,
    suc_chua INT CHECK (suc_chua > 0),
    loai_phong VARCHAR(20) DEFAULT 'ly_thuyet'
        CHECK (loai_phong IN ('ly_thuyet', 'thuc_hanh', 'thi')),
    trang_thai VARCHAR(20) DEFAULT 'hoat_dong'
        CHECK (trang_thai IN ('hoat_dong', 'tam_dung', 'sap_chua'))
);

-- ============================================
-- NHÓM 9: THỜI KHÓA BIỂU
-- ============================================

CREATE TABLE thoi_khoa_bieu (
    tkb_id SERIAL PRIMARY KEY,
    hoc_ky_id INT NOT NULL REFERENCES hoc_ky(hoc_ky_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    nguoi_tao_id INT REFERENCES nguoidung(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    phien_ban INT DEFAULT 1 CHECK (phien_ban > 0),
    trang_thai VARCHAR(20) DEFAULT 'nhap'
        CHECK (trang_thai IN ('nhap', 'cho_phe_duyet', 'da_phe_duyet', 'da_cong_bo')),
    ngay_tao TIMESTAMP DEFAULT NOW(),
    ngay_cong_bo TIMESTAMP,
    ghi_chu TEXT,
    CHECK (ngay_cong_bo IS NULL OR ngay_tao IS NULL OR ngay_cong_bo >= ngay_tao),
    UNIQUE (hoc_ky_id, phien_ban)
);

-- ============================================
-- NHÓM 10: SLOT TKB TUẦN
-- tkb_slot là nguồn dữ liệu TKB chính theo mẫu lặp hàng tuần
-- ============================================

CREATE TABLE tkb_slot (
    tkb_slot_id SERIAL PRIMARY KEY,
    tkb_id INT NOT NULL REFERENCES thoi_khoa_bieu(tkb_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    phan_cong_id INT NOT NULL REFERENCES phan_cong_giang_day(phan_cong_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    phong_hoc_id INT REFERENCES phong_hoc(phong_hoc_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    khung_thoi_gian_id INT NOT NULL REFERENCES khung_thoi_gian(khung_thoi_gian_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    trang_thai VARCHAR(20) DEFAULT 'hoat_dong'
        CHECK (trang_thai IN ('hoat_dong', 'huy')),
    hinh_thuc VARCHAR(20) DEFAULT 'ly_thuyet'
        CHECK (hinh_thuc IN ('ly_thuyet', 'thuc_hanh')),
    ghi_chu TEXT
);

-- ============================================
-- NHÓM 11: BUỔI HỌC / OCCURRENCE
-- hoc_ky_id: KHÔNG CÓ - derive từ thoi_khoa_bieu
-- ============================================

CREATE TABLE buoi_hoc (
    buoi_hoc_id SERIAL PRIMARY KEY,
    tkb_id INT NOT NULL REFERENCES thoi_khoa_bieu(tkb_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    phan_cong_id INT NOT NULL REFERENCES phan_cong_giang_day(phan_cong_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    phong_hoc_id INT REFERENCES phong_hoc(phong_hoc_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    khung_thoi_gian_id INT REFERENCES khung_thoi_gian(khung_thoi_gian_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ngay_hoc DATE NOT NULL,
    trang_thai VARCHAR(20) DEFAULT 'hoat_dong'
        CHECK (trang_thai IN ('hoat_dong', 'huy')),
    hinh_thuc VARCHAR(20) DEFAULT 'ly_thuyet'
        CHECK (hinh_thuc IN ('ly_thuyet', 'thuc_hanh')),
    ghi_chu TEXT
);

-- UNIQUE (phong_hoc_id, khung_thoi_gian_id, ngay_hoc) → partial unique index
-- UNIQUE (phan_cong_id, khung_thoi_gian_id, ngay_hoc) → partial unique index

-- ============================================
-- NHÓM 12: ĐIỀU CHỈNH LỊCH
-- ============================================

CREATE TABLE loai_yeu_cau_catalog (
    loai_yeu_cau_id SERIAL PRIMARY KEY,
    ma_loai VARCHAR(30) UNIQUE NOT NULL,
    ten_loai VARCHAR(100) NOT NULL,
    mo_ta VARCHAR(200)
);

CREATE TABLE hanh_dong_catalog (
    hanh_dong_id SERIAL PRIMARY KEY,
    ma_hanh_dong VARCHAR(30) UNIQUE NOT NULL,
    ten_hanh_dong VARCHAR(100) NOT NULL,
    mo_ta VARCHAR(200)
);

CREATE TABLE yeu_cau_dieu_chinh (
    yeu_cau_id SERIAL PRIMARY KEY,
    tkb_slot_id INT NOT NULL REFERENCES tkb_slot(tkb_slot_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    giang_vien_id INT NOT NULL REFERENCES giangvien(giang_vien_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    loai_yeu_cau_id INT NOT NULL REFERENCES loai_yeu_cau_catalog(loai_yeu_cau_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ly_do TEXT,
    noi_dung_de_xuat TEXT,
    trang_thai VARCHAR(20) DEFAULT 'cho_duyet'
        CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'tu_choi')),
    nguoi_phan_duyet_id INT REFERENCES nguoidung(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ngay_ap_dung DATE,
    ngay_gui TIMESTAMP DEFAULT NOW()
);

CREATE TABLE phan_hoi_yeu_cau (
    phan_hoi_id SERIAL PRIMARY KEY,
    yeu_cau_id INT NOT NULL REFERENCES yeu_cau_dieu_chinh(yeu_cau_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    nguoi_phan_hoi_id INT REFERENCES nguoidung(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    hanh_dong_id INT NOT NULL REFERENCES hanh_dong_catalog(hanh_dong_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    noi_dung_phan_hoi TEXT,
    ngay_phan_hoi TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- NHÓM 13: LỊCH SỬ CẬP NHẬT
-- ============================================

CREATE TABLE lich_su_cap_nhat (
    lich_su_id SERIAL PRIMARY KEY,
    buoi_hoc_id INT REFERENCES buoi_hoc(buoi_hoc_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    nguoi_cap_nhat_id INT REFERENCES nguoidung(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    hanh_dong VARCHAR(20) NOT NULL
        CHECK (hanh_dong IN ('them', 'sua', 'huy')),
    noi_dung_truoc TEXT,
    noi_dung_sau TEXT,
    thoi_gian_cap_nhat TIMESTAMP DEFAULT NOW(),
    ly_do TEXT
);

-- ============================================
-- NHÓM 14: THÔNG BÁO
-- trang_thai_gui: 'cho_gui' | 'da_gui' | 'that_bai'
-- ============================================

CREATE TABLE thong_bao (
    thong_bao_id SERIAL PRIMARY KEY,
    tieu_de VARCHAR(200) NOT NULL,
    noi_dung TEXT,
    loai_thong_bao VARCHAR(30)
        CHECK (loai_thong_bao IN ('thong_tin', 'thay_doi_lich', 'thong_bao_khan', 'yeu_cau')),
    buoi_hoc_id INT REFERENCES buoi_hoc(buoi_hoc_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ngay_tao TIMESTAMP DEFAULT NOW(),
    nguoi_tao_id INT REFERENCES nguoidung(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    UNIQUE (nguoi_tao_id, tieu_de)
);

CREATE TABLE thong_bao_nguoi_nhan (
    id SERIAL PRIMARY KEY,
    thong_bao_id INT REFERENCES thong_bao(thong_bao_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    nguoi_dung_id INT REFERENCES nguoidung(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE (thong_bao_id, nguoi_dung_id),
    da_doc BOOLEAN DEFAULT FALSE,
    thoi_gian_doc TIMESTAMP,
    trang_thai_gui VARCHAR(20) DEFAULT 'cho_gui'
        CHECK (trang_thai_gui IN ('cho_gui', 'da_gui', 'that_bai')),
    CHECK ((da_doc = FALSE) OR (da_doc = TRUE AND trang_thai_gui = 'da_gui')),
    CHECK ((thoi_gian_doc IS NULL) OR (da_doc = TRUE))
);

-- ============================================
-- NHÓM 15: PHÂN LỚP SINH VIÊN
-- ============================================

CREATE TABLE sinhvien_lophocphan (
    id SERIAL PRIMARY KEY,
    sinh_vien_id INT NOT NULL REFERENCES sinhvien(sinh_vien_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    lop_hoc_phan_id INT NOT NULL REFERENCES lop_hoc_phan(lop_hoc_phan_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ngay_phan_lop TIMESTAMP DEFAULT NOW(),
    trang_thai VARCHAR(20) DEFAULT 'hoat_dong'
        CHECK (trang_thai IN ('hoat_dong', 'huy')),
    ghi_chu TEXT,
    UNIQUE (sinh_vien_id, lop_hoc_phan_id)
);

CREATE TABLE log_phan_lop (
    log_id SERIAL PRIMARY KEY,
    sinhvien_lophocphan_id INT REFERENCES sinhvien_lophocphan(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    nguoi_phan_lop_id INT REFERENCES nguoidung(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    hanh_dong_id INT REFERENCES hanh_dong_catalog(hanh_dong_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    thoi_gian TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TRIGGER 1: Chặn trùng lịch giảng viên
-- ============================================

CREATE OR REPLACE FUNCTION kiem_tra_trung_lich_gv()
RETURNS TRIGGER AS $$
DECLARE
    v_gv_id INT;
BEGIN
    SELECT giang_vien_id INTO v_gv_id
    FROM phan_cong_giang_day
    WHERE phan_cong_id = NEW.phan_cong_id;

    IF EXISTS (
        SELECT 1 FROM buoi_hoc bh
        WHERE bh.phan_cong_id IN (
            SELECT phan_cong_id FROM phan_cong_giang_day
            WHERE giang_vien_id = v_gv_id
        )
        AND bh.khung_thoi_gian_id = NEW.khung_thoi_gian_id
        AND bh.ngay_hoc = NEW.ngay_hoc
        AND bh.trang_thai = 'hoat_dong'
        AND bh.buoi_hoc_id != COALESCE(NEW.buoi_hoc_id, 0)
    ) THEN
        RAISE EXCEPTION 'Giảng viên đã có lịch dạy trong khung giờ này!';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trung_lich_gv
BEFORE INSERT OR UPDATE ON buoi_hoc
FOR EACH ROW
WHEN (NEW.trang_thai = 'hoat_dong')
EXECUTE FUNCTION kiem_tra_trung_lich_gv();

-- ============================================
-- TRIGGER 2: Chặn xếp lịch vào giờ GV bận (tuần)
-- Lọc theo hoc_ky_id để tránh lịch bận HK khác ảnh hưởng
-- ============================================

CREATE OR REPLACE FUNCTION kiem_tra_lich_ban_tuan()
RETURNS TRIGGER AS $$
DECLARE
    v_thu   INT;
    v_gv_id INT;
    v_hk_id INT;
BEGIN
    IF NEW.khung_thoi_gian_id IS NULL THEN RETURN NEW; END IF;

    SELECT thu_trong_tuan INTO v_thu
    FROM khung_thoi_gian WHERE khung_thoi_gian_id = NEW.khung_thoi_gian_id;

    SELECT pcgd.giang_vien_id INTO v_gv_id
    FROM phan_cong_giang_day pcgd WHERE pcgd.phan_cong_id = NEW.phan_cong_id;

    SELECT tkb.hoc_ky_id INTO v_hk_id
    FROM thoi_khoa_bieu tkb WHERE tkb.tkb_id = NEW.tkb_id;

    IF EXISTS (
        SELECT 1 FROM lich_ban_tuan lbt
        JOIN khung_thoi_gian ktg ON lbt.khung_thoi_gian_id = ktg.khung_thoi_gian_id
        WHERE lbt.giang_vien_id = v_gv_id
          AND ktg.thu_trong_tuan = v_thu
          AND ktg.khung_thoi_gian_id = NEW.khung_thoi_gian_id
          AND lbt.trang_thai = 'dong_y'
          AND lbt.hoc_ky_id = v_hk_id   -- cùng học kỳ mới chặn
    ) THEN
        RAISE EXCEPTION 'Giảng viên đang bận trong khung giờ này (lịch bận tuần)!';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lich_ban_tuan
BEFORE INSERT OR UPDATE ON buoi_hoc
FOR EACH ROW
WHEN (NEW.trang_thai = 'hoat_dong')
EXECUTE FUNCTION kiem_tra_lich_ban_tuan();

-- ============================================
-- TRIGGER 3: Chặn xếp lịch vào giờ GV bận (ngày)
-- Lọc theo hoc_ky_id để tránh lịch bận HK khác ảnh hưởng
-- ============================================

CREATE OR REPLACE FUNCTION kiem_tra_lich_ban_ngay()
RETURNS TRIGGER AS $$
DECLARE
    v_gv_id INT;
    v_hk_id INT;
BEGIN
    IF NEW.khung_thoi_gian_id IS NULL THEN RETURN NEW; END IF;

    SELECT pcgd.giang_vien_id INTO v_gv_id
    FROM phan_cong_giang_day pcgd WHERE pcgd.phan_cong_id = NEW.phan_cong_id;

    SELECT tkb.hoc_ky_id INTO v_hk_id
    FROM thoi_khoa_bieu tkb WHERE tkb.tkb_id = NEW.tkb_id;

    IF EXISTS (
        SELECT 1 FROM lich_ban_ngay lbn
        WHERE lbn.giang_vien_id = v_gv_id
          AND lbn.ngay_cu_the = NEW.ngay_hoc
          AND lbn.khung_thoi_gian_id = NEW.khung_thoi_gian_id
          AND lbn.trang_thai = 'dong_y'
          AND lbn.hoc_ky_id = v_hk_id   -- cùng học kỳ mới chặn
    ) THEN
        RAISE EXCEPTION 'Giảng viên đang bận trong khung giờ này (lịch bận ngày)!';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lich_ban_ngay
BEFORE INSERT OR UPDATE ON buoi_hoc
FOR EACH ROW
WHEN (NEW.trang_thai = 'hoat_dong')
EXECUTE FUNCTION kiem_tra_lich_ban_ngay();

-- ============================================
-- TRIGGER 3b: Ràng buộc hoc_ky_id đồng nhất
-- buoi_hoc.tkb_id và buoi_hoc.phan_cong_id phải cùng học kỳ
-- ============================================

CREATE OR REPLACE FUNCTION kiem_tra_hoc_ky_dong_nhat()
RETURNS TRIGGER AS $$
DECLARE
    v_hk_tkb  INT;
    v_hk_phan INT;
BEGIN
    SELECT hoc_ky_id INTO v_hk_tkb
    FROM thoi_khoa_bieu WHERE tkb_id = NEW.tkb_id;

    SELECT lhp.hoc_ky_id INTO v_hk_phan
    FROM phan_cong_giang_day pcgd
    JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
    WHERE pcgd.phan_cong_id = NEW.phan_cong_id;

    IF v_hk_tkb != v_hk_phan THEN
        RAISE EXCEPTION
            'Học kỳ của TKB (%) và lớp học phần (%) không khớp!',
            v_hk_tkb, v_hk_phan;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kiem_tra_hoc_ky_dong_nhat
BEFORE INSERT OR UPDATE ON buoi_hoc
FOR EACH ROW
EXECUTE FUNCTION kiem_tra_hoc_ky_dong_nhat();

-- ============================================
-- TRIGGER 4: Chặn vượt sĩ số lớp học phần
-- ============================================

CREATE OR REPLACE FUNCTION kiem_tra_si_so()
RETURNS TRIGGER AS $$
DECLARE
    v_count INT;
    v_max INT;
BEGIN
    IF NEW.trang_thai = 'huy' THEN RETURN NEW; END IF;

    SELECT COUNT(id), MAX(lhp.si_so_toi_da)
    INTO v_count, v_max
    FROM sinhvien_lophocphan svlhp
    JOIN lop_hoc_phan lhp ON svlhp.lop_hoc_phan_id = lhp.lop_hoc_phan_id
    WHERE svlhp.lop_hoc_phan_id = NEW.lop_hoc_phan_id
    AND svlhp.trang_thai = 'hoat_dong';

    IF v_count >= v_max THEN
        RAISE EXCEPTION 'Lớp học phần đã đủ sĩ số (% / %)!', v_count, v_max;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kiem_tra_si_so
BEFORE INSERT ON sinhvien_lophocphan
FOR EACH ROW
WHEN (NEW.trang_thai = 'hoat_dong')
EXECUTE FUNCTION kiem_tra_si_so();

-- ============================================
-- TRIGGER 5: Chặn phòng không đủ sức chứa
-- Theo số SV thực tế trong lớp học phần
-- ============================================

CREATE OR REPLACE FUNCTION kiem_tra_phong()
RETURNS TRIGGER AS $$
DECLARE
    v_suc_chua INT;
    v_sv_count INT;
BEGIN
    IF NEW.phong_hoc_id IS NULL OR NEW.trang_thai = 'huy' THEN RETURN NEW; END IF;

    SELECT ph.suc_chua INTO v_suc_chua
    FROM phong_hoc ph WHERE ph.phong_hoc_id = NEW.phong_hoc_id;

    SELECT COUNT(svlhp.id) INTO v_sv_count
    FROM phan_cong_giang_day pcgd
    JOIN sinhvien_lophocphan svlhp ON pcgd.lop_hoc_phan_id = svlhp.lop_hoc_phan_id
    WHERE pcgd.phan_cong_id = NEW.phan_cong_id
    AND svlhp.trang_thai = 'hoat_dong';

    IF v_suc_chua < v_sv_count THEN
        RAISE EXCEPTION
            'Phòng (sức chứa %) không đủ chỗ cho lớp (đang có % sinh viên)!',
            v_suc_chua, v_sv_count;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kiem_tra_phong
BEFORE INSERT OR UPDATE ON buoi_hoc
FOR EACH ROW
WHEN (NEW.trang_thai = 'hoat_dong')
EXECUTE FUNCTION kiem_tra_phong();

-- ============================================
-- TRIGGER 6: Chặn GV gửi yêu cầu cho buổi học KHÔNG THUỘC VỀ MÌNH
-- ============================================

CREATE OR REPLACE FUNCTION kiem_tra_gv_yeu_cau()
RETURNS TRIGGER AS $$
DECLARE
    v_gv_buoi INT;
BEGIN
    SELECT pcgd.giang_vien_id INTO v_gv_buoi
    FROM tkb_slot ts
    JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
    WHERE ts.tkb_slot_id = NEW.tkb_slot_id;

    IF v_gv_buoi IS NULL OR v_gv_buoi != NEW.giang_vien_id THEN
        RAISE EXCEPTION 'Bạn không có quyền gửi yêu cầu cho slot TKB này!';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kiem_tra_gv_yeu_cau
BEFORE INSERT ON yeu_cau_dieu_chinh
FOR EACH ROW
EXECUTE FUNCTION kiem_tra_gv_yeu_cau();

-- ============================================
-- TRIGGER 7: Tự động cập nhật thoi_gian_doc khi da_doc = TRUE
-- ============================================

CREATE OR REPLACE FUNCTION cap_nhat_thoi_gian_doc()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.da_doc = TRUE AND (OLD.da_doc = FALSE OR OLD.da_doc IS NULL) THEN
        NEW.thoi_gian_doc = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cap_nhat_thoi_gian_doc
BEFORE UPDATE ON thong_bao_nguoi_nhan
FOR EACH ROW
EXECUTE FUNCTION cap_nhat_thoi_gian_doc();

-- ============================================
-- TRIGGER 8: AUDIT - Tự động log thay đổi buoi_hoc
-- FIX: Không dùng cột không tồn tại
-- ============================================

CREATE OR REPLACE FUNCTION audit_buoi_hoc()
RETURNS TRIGGER AS $$
DECLARE
    v_buoi_truoc TEXT;
    v_buoi_sau TEXT;
    v_hanh_dong VARCHAR(20);
    v_ly_do TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_hanh_dong := 'them';
        v_buoi_sau := format(
            'tkb=%s, lhp=%s, phong=%s, thu=%s, tiet=%s-%s, ngay=%s, hinh_thuc=%s',
            NEW.tkb_id, NEW.phan_cong_id, NEW.phong_hoc_id,
            (SELECT thu_trong_tuan FROM khung_thoi_gian WHERE khung_thoi_gian_id = NEW.khung_thoi_gian_id),
            (SELECT tiet_bat_dau FROM khung_thoi_gian WHERE khung_thoi_gian_id = NEW.khung_thoi_gian_id),
            (SELECT tiet_ket_thuc FROM khung_thoi_gian WHERE khung_thoi_gian_id = NEW.khung_thoi_gian_id),
            NEW.ngay_hoc, NEW.hinh_thuc
        );
        v_ly_do := 'Tạo buổi học mới';

        INSERT INTO lich_su_cap_nhat (buoi_hoc_id, hanh_dong, noi_dung_sau, ly_do)
        VALUES (NEW.buoi_hoc_id, v_hanh_dong, v_buoi_sau, v_ly_do);

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.trang_thai != NEW.trang_thai AND NEW.trang_thai = 'huy' THEN
            v_hanh_dong := 'huy';
            v_buoi_truoc := format('trang_thai=%s, phong=%s, ngay=%s', OLD.trang_thai, OLD.phong_hoc_id, OLD.ngay_hoc);
            v_buoi_sau := format('trang_thai=%s', NEW.trang_thai);
            v_ly_do := 'Hủy buổi học';

            INSERT INTO lich_su_cap_nhat (buoi_hoc_id, hanh_dong, noi_dung_truoc, noi_dung_sau, ly_do)
            VALUES (NEW.buoi_hoc_id, v_hanh_dong, v_buoi_truoc, v_buoi_sau, v_ly_do);

        ELSIF OLD.phong_hoc_id != NEW.phong_hoc_id OR OLD.ngay_hoc != NEW.ngay_hoc OR OLD.khung_thoi_gian_id != NEW.khung_thoi_gian_id THEN
            v_hanh_dong := 'sua';
            v_buoi_truoc := format('phong=%s, ngay=%s, khung=%s', OLD.phong_hoc_id, OLD.ngay_hoc, OLD.khung_thoi_gian_id);
            v_buoi_sau := format('phong=%s, ngay=%s, khung=%s', NEW.phong_hoc_id, NEW.ngay_hoc, NEW.khung_thoi_gian_id);
            v_ly_do := 'Cập nhật thông tin buổi học';

            INSERT INTO lich_su_cap_nhat (buoi_hoc_id, hanh_dong, noi_dung_truoc, noi_dung_sau, ly_do)
            VALUES (NEW.buoi_hoc_id, v_hanh_dong, v_buoi_truoc, v_buoi_sau, v_ly_do);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_buoi_hoc_insert
AFTER INSERT ON buoi_hoc
FOR EACH ROW
EXECUTE FUNCTION audit_buoi_hoc();

CREATE TRIGGER trg_audit_buoi_hoc_update
AFTER UPDATE ON buoi_hoc
FOR EACH ROW
EXECUTE FUNCTION audit_buoi_hoc();

-- ============================================
-- TRIGGER 9: Chặn hình thức buổi học không khớp loại phòng
-- Phòng "thi" dùng được cho cả lý thuyết lẫn thực hành
-- Các phòng khác phải khớp hình thức
-- ============================================

CREATE OR REPLACE FUNCTION kiem_tra_hinh_thuc_phong()
RETURNS TRIGGER AS $$
DECLARE
    v_loai_phong VARCHAR(20);
BEGIN
    IF NEW.phong_hoc_id IS NULL THEN RETURN NEW; END IF;

    SELECT loai_phong INTO v_loai_phong
    FROM phong_hoc WHERE phong_hoc_id = NEW.phong_hoc_id;

    -- Phòng thi dùng được cho cả lý thuyết và thực hành
    IF v_loai_phong = 'thi' THEN RETURN NEW; END IF;

    -- Các phòng khác phải khớp hình thức
    IF v_loai_phong != NEW.hinh_thuc THEN
        RAISE EXCEPTION
            'Phòng % (loại: %) không phù hợp cho hình thức "%"!',
            NEW.phong_hoc_id, v_loai_phong, NEW.hinh_thuc;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kiem_tra_hinh_thuc_phong
BEFORE INSERT OR UPDATE ON buoi_hoc
FOR EACH ROW
EXECUTE FUNCTION kiem_tra_hinh_thuc_phong();

-- ============================================
-- TRIGGER 10: Ràng buộc ngay_hoc nằm trong khoảng học kỳ của TKB
-- Thay thế CHECK có subquery (không hỗ trợ tốt trong PostgreSQL)
-- ============================================

CREATE OR REPLACE FUNCTION kiem_tra_ngay_hoc_hoc_ky()
RETURNS TRIGGER AS $$
DECLARE
    v_ngay_dau  DATE;
    v_ngay_cuoi DATE;
BEGIN
    SELECT ngay_bat_dau, ngay_ket_thuc INTO v_ngay_dau, v_ngay_cuoi
    FROM hoc_ky
    WHERE hoc_ky_id = (
        SELECT hoc_ky_id FROM thoi_khoa_bieu WHERE tkb_id = NEW.tkb_id
    );

    IF v_ngay_dau IS NOT NULL AND NEW.ngay_hoc < v_ngay_dau THEN
        RAISE EXCEPTION
            'Ngày học (%) trước ngày bắt đầu học kỳ (%)!',
            NEW.ngay_hoc, v_ngay_dau;
    END IF;

    IF v_ngay_cuoi IS NOT NULL AND NEW.ngay_hoc > v_ngay_cuoi THEN
        RAISE EXCEPTION
            'Ngày học (%) sau ngày kết thúc học kỳ (%)!',
            NEW.ngay_hoc, v_ngay_cuoi;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kiem_tra_ngay_hoc_hoc_ky
BEFORE INSERT OR UPDATE ON buoi_hoc
FOR EACH ROW
EXECUTE FUNCTION kiem_tra_ngay_hoc_hoc_ky();

-- ============================================
-- TRIGGER 11: Ràng buộc ngay_hoc phải khớp thứ trong khung giờ
-- Thứ của ngày (EXTRACT(DOW)) phải trùng thu_trong_tuan trên khung_thoi_gian
-- EXTRACT(DOW): 0=CN, 1=Th2, ..., 6=Th7 → tương ứng thu_trong_tuan 8→0, 2→2
-- ============================================

CREATE OR REPLACE FUNCTION kiem_tra_thu_trong_tuan()
RETURNS TRIGGER AS $$
DECLARE
    v_thu_khung INT;
    v_thu_ngay  INT;
BEGIN
    IF NEW.khung_thoi_gian_id IS NULL THEN RETURN NEW; END IF;

    SELECT thu_trong_tuan INTO v_thu_khung
    FROM khung_thoi_gian WHERE khung_thoi_gian_id = NEW.khung_thoi_gian_id;

    -- PostgreSQL EXTRACT(DOW): 0=CN, 1=Th2, ... 6=Th7
    -- thu_trong_tuan:          8=CN, 2=Th2, ... 7=Th7
    -- Chuyển đổi: v_thu_ngay = 0 → 8, 1 → 2, ..., 6 → 7
    v_thu_ngay := CASE EXTRACT(DOW FROM NEW.ngay_hoc)
        WHEN 0 THEN 8
        ELSE EXTRACT(DOW FROM NEW.ngay_hoc) + 1
    END;

    IF v_thu_khung != v_thu_ngay THEN
        RAISE EXCEPTION
            'Ngày % (thứ %) không khớp khung thời gian (thứ %). Kiểm tra lại ngày hoặc khung giờ!',
            NEW.ngay_hoc, v_thu_ngay, v_thu_khung;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kiem_tra_thu_trong_tuan
BEFORE INSERT OR UPDATE ON buoi_hoc
FOR EACH ROW
EXECUTE FUNCTION kiem_tra_thu_trong_tuan();

-- ============================================
-- INDEX
-- ============================================

CREATE INDEX idx_buoi_hoc_ngay ON buoi_hoc(ngay_hoc);
CREATE INDEX idx_buoi_hoc_tkb ON buoi_hoc(tkb_id);
CREATE INDEX idx_buoi_hoc_phan_cong ON buoi_hoc(phan_cong_id);
CREATE INDEX idx_buoi_hoc_phong ON buoi_hoc(phong_hoc_id);
CREATE INDEX idx_buoi_hoc_khung ON buoi_hoc(khung_thoi_gian_id);
CREATE INDEX idx_tkb_slot_tkb ON tkb_slot(tkb_id);
CREATE INDEX idx_tkb_slot_phan_cong ON tkb_slot(phan_cong_id);
CREATE INDEX idx_tkb_slot_phong ON tkb_slot(phong_hoc_id);
CREATE INDEX idx_tkb_slot_khung ON tkb_slot(khung_thoi_gian_id);
CREATE UNIQUE INDEX idx_tkb_slot_lhp_unique ON tkb_slot(tkb_id, phan_cong_id)
    WHERE trang_thai = 'hoat_dong';
CREATE UNIQUE INDEX idx_tkb_slot_phong_unique ON tkb_slot(tkb_id, phong_hoc_id, khung_thoi_gian_id)
    WHERE trang_thai = 'hoat_dong' AND phong_hoc_id IS NOT NULL;
-- Partial unique index: chỉ chặn trùng khi trang_thai='hoat_dong'
CREATE UNIQUE INDEX idx_buoi_hoc_phong_unique ON buoi_hoc(phong_hoc_id, khung_thoi_gian_id, ngay_hoc)
    WHERE trang_thai = 'hoat_dong';
CREATE UNIQUE INDEX idx_buoi_hoc_lhp_unique ON buoi_hoc(phan_cong_id, khung_thoi_gian_id, ngay_hoc)
    WHERE trang_thai = 'hoat_dong';
-- Partial index cho buổi học đang hoạt động
CREATE INDEX idx_buoi_hoc_active ON buoi_hoc(ngay_hoc) WHERE trang_thai = 'hoat_dong';
CREATE INDEX idx_lop_hp_hk ON lop_hoc_phan(hoc_ky_id);
CREATE INDEX idx_phan_cong_lhp ON phan_cong_giang_day(lop_hoc_phan_id);
CREATE INDEX idx_phan_cong_gv ON phan_cong_giang_day(giang_vien_id);
CREATE INDEX idx_thong_bao_nguoi ON thong_bao_nguoi_nhan(nguoi_dung_id);
CREATE INDEX idx_yeu_cau_trang_thai ON yeu_cau_dieu_chinh(trang_thai);
CREATE INDEX idx_yeu_cau_gv ON yeu_cau_dieu_chinh(giang_vien_id);
CREATE INDEX idx_yeu_cau_slot ON yeu_cau_dieu_chinh(tkb_slot_id);
CREATE INDEX idx_lich_ban_tuan_gv ON lich_ban_tuan(giang_vien_id);
CREATE INDEX idx_lich_ban_tuan_khung ON lich_ban_tuan(khung_thoi_gian_id);
CREATE INDEX idx_lich_ban_ngay_gv ON lich_ban_ngay(giang_vien_id);
CREATE INDEX idx_lich_ban_ngay_khung ON lich_ban_ngay(khung_thoi_gian_id);
CREATE INDEX idx_lich_ban_ngay_ngay ON lich_ban_ngay(ngay_cu_the);
CREATE INDEX idx_khung_tuan_thu ON khung_thoi_gian(thu_trong_tuan);
CREATE INDEX idx_sinhvien_lhp ON sinhvien_lophocphan(sinh_vien_id);
CREATE INDEX idx_sinhvien_lhp_lhp ON sinhvien_lophocphan(lop_hoc_phan_id);
CREATE INDEX idx_log_phan_lop ON log_phan_lop(sinhvien_lophocphan_id);
CREATE INDEX idx_lich_su_buoi ON lich_su_cap_nhat(buoi_hoc_id);

-- ============================================
-- KẾT THÚC SCHEMA
-- Tiếp theo: chạy seed_data.sql để nạp dữ liệu mẫu
-- ============================================
SELECT '✅ init_schema.sql — Schema only (no seed data)' AS status;
