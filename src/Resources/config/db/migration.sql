CREATE TABLE migration_versions (
    version VARCHAR(14) CONSTRAINT migration_versions_pkey PRIMARY KEY,
    executed_at TIMESTAMP(0) NOT NULL
);

COMMENT ON COLUMN migration_versions.executed_at IS '(DC2Type:datetime_immutable)';

INSERT INTO migration_versions (version, executed_at) VALUES
('20190220111002', NOW()),
('20190220112416', NOW()),
('20190220112636', NOW());
