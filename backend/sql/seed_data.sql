-- ============================================
-- SEED DATA: TKB_KHOA_CNTT
-- Chạy sau init_database.sql
-- Mật khẩu mặc định cho tất cả tài khoản: tkb123
-- ============================================

TRUNCATE
    phan_hoi_yeu_cau,
    yeu_cau_dieu_chinh,
    lich_su_cap_nhat,
    thong_bao_nguoi_nhan,
    thong_bao,
    buoi_hoc,
    tkb_slot,
    sinhvien_lophocphan,
    log_phan_lop,
    phan_cong_giang_day,
    thoi_khoa_bieu,
    lop_hoc_phan,
    phong_hoc,
    lop_hanh_chinh,
    sinhvien,
    giangvien,
    hoc_ky,
    mon_hoc,
    khung_thoi_gian,
    loai_yeu_cau_catalog,
    hanh_dong_catalog,
    token_revocation,
    nguoidung_vai_tro,
    nguoidung,
    vai_tro_catalog
RESTART IDENTITY CASCADE;

INSERT INTO vai_tro_catalog (ten_vai_tro, thu_tu_uu_tien, mo_ta) VALUES
('admin', 1, 'Quản trị hệ thống'),
('truong_khoa', 2, 'Trưởng khoa'),
('giao_vu', 3, 'Giáo vụ'),
('giang_vien', 4, 'Giảng viên'),
('sinh_vien', 5, 'Sinh viên');

INSERT INTO nguoidung (ho_ten, email, mat_khau, trang_thai) VALUES
('Quản Trị Hệ Thống', 'admin@cntt.edu.vn', '$2a$10$I/qYz6RQZD4fuUZb2D3WlOyH7mo1uTnhStG4SU0M49gX5j07GPDoe', 'hoat_dong'),
('Nguyễn Thị Hương Giang', 'giaovu@cntt.edu.vn', '$2a$10$I/qYz6RQZD4fuUZb2D3WlOyH7mo1uTnhStG4SU0M49gX5j07GPDoe', 'hoat_dong'),
('TS. Trần Văn Minh', 'gv1@cntt.edu.vn', '$2a$10$I/qYz6RQZD4fuUZb2D3WlOyH7mo1uTnhStG4SU0M49gX5j07GPDoe', 'hoat_dong'),
('ThS. Lê Thị Mai', 'gv2@cntt.edu.vn', '$2a$10$I/qYz6RQZD4fuUZb2D3WlOyH7mo1uTnhStG4SU0M49gX5j07GPDoe', 'hoat_dong'),
('PGS.TS. Phạm Hoàng Nam', 'gv3@cntt.edu.vn', '$2a$10$I/qYz6RQZD4fuUZb2D3WlOyH7mo1uTnhStG4SU0M49gX5j07GPDoe', 'hoat_dong'),
('PGS.TS. Ngô Đình Phong', 'truongkhoa@cntt.edu.vn', '$2a$10$I/qYz6RQZD4fuUZb2D3WlOyH7mo1uTnhStG4SU0M49gX5j07GPDoe', 'hoat_dong'),
('Nguyễn Văn An', 'sv1@cntt.edu.vn', '$2a$10$I/qYz6RQZD4fuUZb2D3WlOyH7mo1uTnhStG4SU0M49gX5j07GPDoe', 'hoat_dong'),
('Trần Thị Bình', 'sv2@cntt.edu.vn', '$2a$10$I/qYz6RQZD4fuUZb2D3WlOyH7mo1uTnhStG4SU0M49gX5j07GPDoe', 'hoat_dong'),
('Nguyễn Thị Lan', 'sv3@cntt.edu.vn', '$2a$10$I/qYz6RQZD4fuUZb2D3WlOyH7mo1uTnhStG4SU0M49gX5j07GPDoe', 'hoat_dong'),
('Đặng Minh Tuấn', 'sv4@cntt.edu.vn', '$2a$10$I/qYz6RQZD4fuUZb2D3WlOyH7mo1uTnhStG4SU0M49gX5j07GPDoe', 'hoat_dong');

INSERT INTO nguoidung_vai_tro (user_id, vai_tro_id)
SELECT nd.user_id, vt.vai_tro_id
FROM nguoidung nd
JOIN vai_tro_catalog vt ON (nd.email, vt.ten_vai_tro) IN (
    ('admin@cntt.edu.vn', 'admin'),
    ('giaovu@cntt.edu.vn', 'giao_vu'),
    ('gv1@cntt.edu.vn', 'giang_vien'),
    ('gv2@cntt.edu.vn', 'giang_vien'),
    ('gv3@cntt.edu.vn', 'giang_vien'),
    ('truongkhoa@cntt.edu.vn', 'truong_khoa'),
    ('truongkhoa@cntt.edu.vn', 'giang_vien'),
    ('sv1@cntt.edu.vn', 'sinh_vien'),
    ('sv2@cntt.edu.vn', 'sinh_vien'),
    ('sv3@cntt.edu.vn', 'sinh_vien'),
    ('sv4@cntt.edu.vn', 'sinh_vien')
);

INSERT INTO giangvien (user_id, ma_gv, hoc_vi, gioi_han_tai_giang) VALUES
((SELECT user_id FROM nguoidung WHERE email = 'gv1@cntt.edu.vn'), 'GV001', 'TS.', 0),
((SELECT user_id FROM nguoidung WHERE email = 'gv2@cntt.edu.vn'), 'GV002', 'ThS.', 0),
((SELECT user_id FROM nguoidung WHERE email = 'gv3@cntt.edu.vn'), 'GV003', 'PGS.TS.', 0),
((SELECT user_id FROM nguoidung WHERE email = 'truongkhoa@cntt.edu.vn'), 'GV004', 'PGS.TS.', 0);

INSERT INTO lop_hanh_chinh (ma_lop, ten_lop, khoa, nam_nhap_hoc, giao_vien_chu_nhiem_id) VALUES
('CNTT-K64A', 'CNTT K64A', 'CNTT', 2024, (SELECT giang_vien_id FROM giangvien WHERE ma_gv = 'GV001')),
('CNTT-K64B', 'CNTT K64B', 'CNTT', 2024, (SELECT giang_vien_id FROM giangvien WHERE ma_gv = 'GV002'));

INSERT INTO sinhvien (user_id, ma_sv, lop_hanh_chinh_id) VALUES
((SELECT user_id FROM nguoidung WHERE email = 'sv1@cntt.edu.vn'), 'SV2024001', (SELECT lop_hanh_chinh_id FROM lop_hanh_chinh WHERE ma_lop = 'CNTT-K64A')),
((SELECT user_id FROM nguoidung WHERE email = 'sv2@cntt.edu.vn'), 'SV2024002', (SELECT lop_hanh_chinh_id FROM lop_hanh_chinh WHERE ma_lop = 'CNTT-K64A')),
((SELECT user_id FROM nguoidung WHERE email = 'sv3@cntt.edu.vn'), 'SV2024003', (SELECT lop_hanh_chinh_id FROM lop_hanh_chinh WHERE ma_lop = 'CNTT-K64B')),
((SELECT user_id FROM nguoidung WHERE email = 'sv4@cntt.edu.vn'), 'SV2024004', (SELECT lop_hanh_chinh_id FROM lop_hanh_chinh WHERE ma_lop = 'CNTT-K64B'));

INSERT INTO hoc_ky (ten_hoc_ky, nam_hoc, ngay_bat_dau, ngay_ket_thuc, trang_thai) VALUES
('Học kỳ 1', '2025-2026', '2025-09-01', '2025-12-31', 'ket_thuc'),
('Học kỳ 2', '2025-2026', '2026-01-06', '2026-05-31', 'hoat_dong');

INSERT INTO mon_hoc (ma_mon, ten_mon, so_tin_chi, so_tiet) VALUES
('CS101', 'Nhập môn Lập trình', 3, 45),
('CS102', 'Tin học văn phòng', 2, 30),
('CS201', 'Cấu trúc dữ liệu', 3, 45),
('CS302', 'Mạng máy tính', 3, 45),
('AD212', 'Phương pháp hùng biện và thủ thuật tranh biện', 2, 30),
('IS430', 'Công nghệ Blockchain', 3, 45);

INSERT INTO khung_thoi_gian (thu_trong_tuan, tiet_bat_dau, tiet_ket_thuc, gio_bat_dau, gio_ket_thuc, mo_ta) VALUES
(2, 1, 3, '07:00', '09:30', 'Sáng 1 - Thứ 2'),
(2, 4, 6, '09:40', '12:10', 'Sáng 2 - Thứ 2'),
(2, 7, 9, '13:30', '16:00', 'Chiều 1 - Thứ 2'),
(3, 1, 3, '07:00', '09:30', 'Sáng 1 - Thứ 3'),
(3, 4, 6, '09:40', '12:10', 'Sáng 2 - Thứ 3'),
(3, 7, 9, '13:30', '16:00', 'Chiều 1 - Thứ 3'),
(4, 1, 3, '07:00', '09:30', 'Sáng 1 - Thứ 4'),
(4, 4, 6, '09:40', '12:10', 'Sáng 2 - Thứ 4'),
(4, 7, 9, '13:30', '16:00', 'Chiều 1 - Thứ 4'),
(5, 1, 3, '07:00', '09:30', 'Sáng 1 - Thứ 5'),
(5, 4, 6, '09:40', '12:10', 'Sáng 2 - Thứ 5'),
(5, 7, 9, '13:30', '16:00', 'Chiều 1 - Thứ 5'),
(6, 1, 3, '07:00', '09:30', 'Sáng 1 - Thứ 6'),
(6, 4, 6, '09:40', '12:10', 'Sáng 2 - Thứ 6'),
(6, 7, 9, '13:30', '16:00', 'Chiều 1 - Thứ 6'),
(7, 1, 3, '07:00', '09:30', 'Sáng 1 - Thứ 7'),
(7, 4, 6, '09:40', '12:10', 'Sáng 2 - Thứ 7'),
(8, 1, 3, '07:00', '09:30', 'Sáng 1 - Chủ nhật');

INSERT INTO loai_yeu_cau_catalog (ma_loai, ten_loai, mo_ta) VALUES
('doi_phong', 'Đổi phòng', 'Yêu cầu đổi phòng học'),
('doi_gv', 'Đổi giảng viên', 'Yêu cầu đổi giảng viên'),
('doi_thoi_gian', 'Đổi thời gian', 'Yêu cầu đổi khung giờ'),
('huy_buoi', 'Hủy slot', 'Yêu cầu hủy slot TKB');

INSERT INTO hanh_dong_catalog (ma_hanh_dong, ten_hanh_dong, mo_ta) VALUES
('them', 'Thêm mới', 'Thêm sinh viên vào lớp học phần'),
('xoa', 'Xóa', 'Hủy đăng ký lớp học phần'),
('sua', 'Sửa', 'Cập nhật thông tin'),
('dong_y', 'Đồng ý', 'Đồng ý yêu cầu điều chỉnh'),
('tu_choi', 'Từ chối', 'Từ chối yêu cầu điều chỉnh'),
('duyet_yc', 'Duyệt yêu cầu', 'Tương thích dữ liệu cũ');

INSERT INTO phong_hoc (ma_phong, ten_phong, suc_chua, loai_phong, trang_thai) VALUES
('A101', 'Phòng A101', 60, 'ly_thuyet', 'hoat_dong'),
('A201', 'Phòng A201', 50, 'ly_thuyet', 'hoat_dong'),
('A301', 'Phòng A301', 40, 'ly_thuyet', 'hoat_dong'),
('A702', 'Phòng A702', 30, 'thuc_hanh', 'hoat_dong'),
('GD.Grothendieck', 'Giảng đường Grothendieck', 80, 'ly_thuyet', 'hoat_dong');

INSERT INTO lop_hoc_phan (mon_hoc_id, hoc_ky_id, ma_lop_hp, ten_lop_hp, si_so_toi_da, trang_thai) VALUES
((SELECT mon_hoc_id FROM mon_hoc WHERE ma_mon = 'CS101'), (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026'), '252CS10101', 'NMLT - 01', 60, 'hoat_dong'),
((SELECT mon_hoc_id FROM mon_hoc WHERE ma_mon = 'CS102'), (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026'), '252CS10201', 'THVP - 01', 60, 'hoat_dong'),
((SELECT mon_hoc_id FROM mon_hoc WHERE ma_mon = 'CS201'), (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026'), '252CS20101', 'CTDL - 01', 50, 'hoat_dong'),
((SELECT mon_hoc_id FROM mon_hoc WHERE ma_mon = 'CS302'), (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026'), '252CS30201', 'Mạng MT - 01', 50, 'hoat_dong'),
((SELECT mon_hoc_id FROM mon_hoc WHERE ma_mon = 'AD212'), (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026'), '252AD21201', 'Hùng biện - 01', 40, 'hoat_dong'),
((SELECT mon_hoc_id FROM mon_hoc WHERE ma_mon = 'IS430'), (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026'), '252IS43001', 'Blockchain - 01', 40, 'hoat_dong');

INSERT INTO phan_cong_giang_day (lop_hoc_phan_id, giang_vien_id, vai_tro_phu_trach) VALUES
((SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS10101'), (SELECT giang_vien_id FROM giangvien WHERE ma_gv = 'GV001'), 'chinh'),
((SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS10201'), (SELECT giang_vien_id FROM giangvien WHERE ma_gv = 'GV001'), 'chinh'),
((SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS20101'), (SELECT giang_vien_id FROM giangvien WHERE ma_gv = 'GV001'), 'chinh'),
((SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS30201'), (SELECT giang_vien_id FROM giangvien WHERE ma_gv = 'GV002'), 'chinh'),
((SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252AD21201'), (SELECT giang_vien_id FROM giangvien WHERE ma_gv = 'GV004'), 'chinh'),
((SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252IS43001'), (SELECT giang_vien_id FROM giangvien WHERE ma_gv = 'GV002'), 'chinh');

INSERT INTO thoi_khoa_bieu (hoc_ky_id, nguoi_tao_id, phien_ban, trang_thai, ngay_tao, ngay_cong_bo, ghi_chu) VALUES
((SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026'),
 (SELECT user_id FROM nguoidung WHERE email = 'giaovu@cntt.edu.vn'),
 1,
 'da_cong_bo',
 NOW(),
 NOW(),
 'TKB công bố cho HK2 2025-2026');

INSERT INTO tkb_slot (tkb_id, phan_cong_id, phong_hoc_id, khung_thoi_gian_id, hinh_thuc, trang_thai, ghi_chu) VALUES
((SELECT tkb_id FROM thoi_khoa_bieu WHERE phien_ban = 1 AND hoc_ky_id = (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026')),
 (SELECT phan_cong_id FROM phan_cong_giang_day pcgd JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id WHERE lhp.ma_lop_hp = '252CS10101'),
 (SELECT phong_hoc_id FROM phong_hoc WHERE ma_phong = 'GD.Grothendieck'),
 (SELECT khung_thoi_gian_id FROM khung_thoi_gian WHERE thu_trong_tuan = 2 AND tiet_bat_dau = 1 AND tiet_ket_thuc = 3),
 'ly_thuyet', 'hoat_dong', NULL),
((SELECT tkb_id FROM thoi_khoa_bieu WHERE phien_ban = 1 AND hoc_ky_id = (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026')),
 (SELECT phan_cong_id FROM phan_cong_giang_day pcgd JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id WHERE lhp.ma_lop_hp = '252CS10201'),
 (SELECT phong_hoc_id FROM phong_hoc WHERE ma_phong = 'A702'),
 (SELECT khung_thoi_gian_id FROM khung_thoi_gian WHERE thu_trong_tuan = 4 AND tiet_bat_dau = 7 AND tiet_ket_thuc = 9),
 'thuc_hanh', 'hoat_dong', NULL),
((SELECT tkb_id FROM thoi_khoa_bieu WHERE phien_ban = 1 AND hoc_ky_id = (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026')),
 (SELECT phan_cong_id FROM phan_cong_giang_day pcgd JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id WHERE lhp.ma_lop_hp = '252CS20101'),
 (SELECT phong_hoc_id FROM phong_hoc WHERE ma_phong = 'A201'),
 (SELECT khung_thoi_gian_id FROM khung_thoi_gian WHERE thu_trong_tuan = 5 AND tiet_bat_dau = 4 AND tiet_ket_thuc = 6),
 'ly_thuyet', 'hoat_dong', NULL),
((SELECT tkb_id FROM thoi_khoa_bieu WHERE phien_ban = 1 AND hoc_ky_id = (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026')),
 (SELECT phan_cong_id FROM phan_cong_giang_day pcgd JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id WHERE lhp.ma_lop_hp = '252CS30201'),
 (SELECT phong_hoc_id FROM phong_hoc WHERE ma_phong = 'A101'),
 (SELECT khung_thoi_gian_id FROM khung_thoi_gian WHERE thu_trong_tuan = 6 AND tiet_bat_dau = 1 AND tiet_ket_thuc = 3),
 'ly_thuyet', 'hoat_dong', NULL),
((SELECT tkb_id FROM thoi_khoa_bieu WHERE phien_ban = 1 AND hoc_ky_id = (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026')),
 (SELECT phan_cong_id FROM phan_cong_giang_day pcgd JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id WHERE lhp.ma_lop_hp = '252AD21201'),
 (SELECT phong_hoc_id FROM phong_hoc WHERE ma_phong = 'A301'),
 (SELECT khung_thoi_gian_id FROM khung_thoi_gian WHERE thu_trong_tuan = 7 AND tiet_bat_dau = 1 AND tiet_ket_thuc = 3),
 'ly_thuyet', 'hoat_dong', NULL),
((SELECT tkb_id FROM thoi_khoa_bieu WHERE phien_ban = 1 AND hoc_ky_id = (SELECT hoc_ky_id FROM hoc_ky WHERE ten_hoc_ky = 'Học kỳ 2' AND nam_hoc = '2025-2026')),
 (SELECT phan_cong_id FROM phan_cong_giang_day pcgd JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id WHERE lhp.ma_lop_hp = '252IS43001'),
 (SELECT phong_hoc_id FROM phong_hoc WHERE ma_phong = 'GD.Grothendieck'),
 (SELECT khung_thoi_gian_id FROM khung_thoi_gian WHERE thu_trong_tuan = 6 AND tiet_bat_dau = 4 AND tiet_ket_thuc = 6),
 'ly_thuyet', 'hoat_dong', NULL);

INSERT INTO sinhvien_lophocphan (sinh_vien_id, lop_hoc_phan_id, trang_thai) VALUES
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024001'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS10101'), 'hoat_dong'),
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024001'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS10201'), 'hoat_dong'),
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024001'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS20101'), 'hoat_dong'),
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024001'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252AD21201'), 'hoat_dong'),
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024002'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS10101'), 'hoat_dong'),
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024002'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS10201'), 'hoat_dong'),
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024002'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS20101'), 'hoat_dong'),
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024003'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS30201'), 'hoat_dong'),
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024003'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252IS43001'), 'hoat_dong'),
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024004'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252CS30201'), 'hoat_dong'),
((SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = 'SV2024004'), (SELECT lop_hoc_phan_id FROM lop_hoc_phan WHERE ma_lop_hp = '252IS43001'), 'hoat_dong');

INSERT INTO yeu_cau_dieu_chinh (
    tkb_slot_id,
    giang_vien_id,
    loai_yeu_cau_id,
    ly_do,
    noi_dung_de_xuat,
    trang_thai,
    nguoi_phan_duyet_id,
    ngay_ap_dung,
    ngay_gui
) VALUES
(
    (SELECT tkb_slot_id FROM tkb_slot ts
     JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
     JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
     WHERE lhp.ma_lop_hp = '252CS20101'),
    (SELECT giang_vien_id FROM giangvien WHERE ma_gv = 'GV001'),
    (SELECT loai_yeu_cau_id FROM loai_yeu_cau_catalog WHERE ma_loai = 'doi_phong'),
    'Phòng A201 không phù hợp cho lớp học có sĩ số đông.',
    'Đề xuất chuyển sang GD.Grothendieck.',
    'cho_duyet',
    NULL,
    NULL,
    NOW()
),
(
    (SELECT tkb_slot_id FROM tkb_slot ts
     JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
     JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
     WHERE lhp.ma_lop_hp = '252IS43001'),
    (SELECT giang_vien_id FROM giangvien WHERE ma_gv = 'GV002'),
    (SELECT loai_yeu_cau_id FROM loai_yeu_cau_catalog WHERE ma_loai = 'doi_thoi_gian'),
    'Cần đổi giờ học để phù hợp lịch công tác.',
    'Đề xuất đổi sang Thứ 5 tiết 1-3.',
    'da_duyet',
    (SELECT user_id FROM nguoidung WHERE email = 'truongkhoa@cntt.edu.vn'),
    NULL,
    NOW() - INTERVAL '2 day'
);

INSERT INTO phan_hoi_yeu_cau (yeu_cau_id, nguoi_phan_hoi_id, hanh_dong_id, noi_dung_phan_hoi, ngay_phan_hoi) VALUES
(
    (SELECT yeu_cau_id FROM yeu_cau_dieu_chinh WHERE trang_thai = 'da_duyet' LIMIT 1),
    (SELECT user_id FROM nguoidung WHERE email = 'truongkhoa@cntt.edu.vn'),
    (SELECT hanh_dong_id FROM hanh_dong_catalog WHERE ma_hanh_dong = 'dong_y'),
    'Đồng ý về chủ trương. Giáo vụ cần cập nhật ở phiên bản sau.',
    NOW() - INTERVAL '1 day'
);

INSERT INTO thong_bao (tieu_de, noi_dung, loai_thong_bao, nguoi_tao_id) VALUES
('Công bố thời khóa biểu HK2 2025-2026', 'Thời khóa biểu học kỳ 2 đã được công bố theo mẫu lịch tuần.', 'thong_tin', (SELECT user_id FROM nguoidung WHERE email = 'giaovu@cntt.edu.vn')),
('Thông báo lịch thi HK2 2025-2026', 'Lịch thi sẽ được cập nhật vào đầu tháng 5.', 'thong_tin', (SELECT user_id FROM nguoidung WHERE email = 'giaovu@cntt.edu.vn'));

INSERT INTO thong_bao_nguoi_nhan (thong_bao_id, nguoi_dung_id, trang_thai_gui, da_doc) 
SELECT
    (SELECT thong_bao_id FROM thong_bao WHERE tieu_de = 'Công bố thời khóa biểu HK2 2025-2026'),
    nd.user_id,
    'da_gui',
    FALSE
FROM nguoidung nd
WHERE nd.email <> 'admin@cntt.edu.vn';

INSERT INTO thong_bao_nguoi_nhan (thong_bao_id, nguoi_dung_id, trang_thai_gui, da_doc)
SELECT
    (SELECT thong_bao_id FROM thong_bao WHERE tieu_de = 'Thông báo lịch thi HK2 2025-2026'),
    nd.user_id,
    'da_gui',
    FALSE
FROM nguoidung nd
JOIN nguoidung_vai_tro nvt ON nd.user_id = nvt.user_id
JOIN vai_tro_catalog vt ON nvt.vai_tro_id = vt.vai_tro_id
WHERE vt.ten_vai_tro IN ('giang_vien', 'sinh_vien');

INSERT INTO lich_ban_tuan (giang_vien_id, hoc_ky_id, khung_thoi_gian_id, ly_do, trang_thai)
SELECT
    gv.giang_vien_id,
    hk.hoc_ky_id,
    ktg.khung_thoi_gian_id,
    'Họp bộ môn định kỳ',
    'cho_duyet'
FROM giangvien gv
JOIN hoc_ky hk
    ON hk.ten_hoc_ky = 'Học kỳ 2'
   AND hk.nam_hoc = '2025-2026'
JOIN khung_thoi_gian ktg
    ON ktg.thu_trong_tuan = 2
   AND ktg.tiet_bat_dau = 1
   AND ktg.tiet_ket_thuc = 3
WHERE gv.ma_gv = 'GV001';

INSERT INTO lich_ban_ngay (giang_vien_id, hoc_ky_id, khung_thoi_gian_id, ngay_cu_the, ly_do, trang_thai)
SELECT
    gv.giang_vien_id,
    hk.hoc_ky_id,
    ktg.khung_thoi_gian_id,
    DATE '2026-04-21',
    'Công tác tại doanh nghiệp đối tác',
    'dong_y'
FROM giangvien gv
JOIN hoc_ky hk
    ON hk.ten_hoc_ky = 'Học kỳ 2'
   AND hk.nam_hoc = '2025-2026'
JOIN khung_thoi_gian ktg
    ON ktg.thu_trong_tuan = 3
   AND ktg.tiet_bat_dau = 7
   AND ktg.tiet_ket_thuc = 9
WHERE gv.ma_gv = 'GV002';

INSERT INTO lich_ban_ngay (giang_vien_id, hoc_ky_id, khung_thoi_gian_id, ngay_cu_the, ly_do, trang_thai)
SELECT
    gv.giang_vien_id,
    hk.hoc_ky_id,
    ktg.khung_thoi_gian_id,
    DATE '2026-04-24',
    'Xin nghỉ ca để xử lý việc cá nhân',
    'tu_choi'
FROM giangvien gv
JOIN hoc_ky hk
    ON hk.ten_hoc_ky = 'Học kỳ 2'
   AND hk.nam_hoc = '2025-2026'
JOIN khung_thoi_gian ktg
    ON ktg.thu_trong_tuan = 6
   AND ktg.tiet_bat_dau = 1
   AND ktg.tiet_ket_thuc = 3
WHERE gv.ma_gv = 'GV003';

SELECT 'seed_data.sql loaded with weekly tkb_slot demo data' AS status;
