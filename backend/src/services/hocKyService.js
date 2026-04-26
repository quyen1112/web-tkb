async function listHocKy(pool, { limit = 50, offset = 0 } = {}) {
  const result = await pool.query(
    'SELECT * FROM hoc_ky ORDER BY nam_hoc DESC, ten_hoc_ky DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );

  return result.rows;
}

module.exports = {
  listHocKy,
};
