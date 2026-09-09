-- Laporan kunjungan sales. Satu baris per outlet per sales.
CREATE TABLE IF NOT EXISTS visits (
  outlet_code INTEGER NOT NULL,
  by_email    TEXT    NOT NULL,
  status      TEXT    NOT NULL,
  supply      TEXT,
  note        TEXT,
  visited_at  TEXT    NOT NULL,
  lat         REAL,
  lng         REAL,
  PRIMARY KEY (outlet_code, by_email)
);

CREATE INDEX IF NOT EXISTS visits_by_email ON visits (by_email);
CREATE INDEX IF NOT EXISTS visits_visited_at ON visits (visited_at DESC);
