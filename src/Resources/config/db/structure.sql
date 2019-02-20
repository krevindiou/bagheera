CREATE SCHEMA IF NOT EXISTS public;

CREATE FUNCTION set_created_at() RETURNS TRIGGER AS $$
BEGIN
   NEW.created_at = NOW();
   RETURN NEW;
END;
$$ language plpgsql;

CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language plpgsql;

CREATE TABLE member (
    member_id SERIAL PRIMARY KEY,
    email VARCHAR(128) UNIQUE NOT NULL,
    password VARCHAR(60) NOT NULL,
    country VARCHAR(2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0),
    logged_at TIMESTAMP(0)
);

CREATE TRIGGER set_created_at_member
    BEFORE INSERT ON member
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_member
    BEFORE UPDATE ON member
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE category (
    category_id SERIAL PRIMARY KEY,
    parent_category_id INT REFERENCES category (category_id),
    type VARCHAR(8) NOT NULL CHECK (type IN ('debit', 'credit')),
    name VARCHAR(32) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0)
);

CREATE TRIGGER set_created_at_category
    BEFORE INSERT ON category
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_category
    BEFORE UPDATE ON category
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE payment_method (
    payment_method_id SERIAL PRIMARY KEY,
    name VARCHAR(16) NOT NULL,
    type VARCHAR(8) CHECK (type IN ('debit', 'credit')),
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0)
);

CREATE TRIGGER set_created_at_payment_method
    BEFORE INSERT ON payment_method
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_payment_method
    BEFORE UPDATE ON payment_method
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE provider (
    provider_id SMALLSERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    country VARCHAR(2) NOT NULL,
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0)
);

CREATE TRIGGER set_created_at_provider
    BEFORE INSERT ON provider
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_provider
    BEFORE UPDATE ON provider
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE bank (
    bank_id SERIAL PRIMARY KEY,
    member_id INT NOT NULL REFERENCES member (member_id),
    provider_id SMALLINT REFERENCES provider (provider_id),
    name VARCHAR(32) NOT NULL,
    sort_order SMALLINT NOT NULL,
    is_favorite BOOLEAN NOT NULL DEFAULT TRUE,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0)
);

CREATE TRIGGER set_created_at_bank
    BEFORE INSERT ON bank
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_bank
    BEFORE UPDATE ON bank
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE bank_access (
    bank_id INT NOT NULL PRIMARY KEY,
    login VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0)
);

CREATE TRIGGER set_created_at_bank_access
    BEFORE INSERT ON bank_access
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_bank_access
    BEFORE UPDATE ON bank_access
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE account (
    account_id SERIAL PRIMARY KEY,
    bank_id INT NOT NULL REFERENCES bank (bank_id),
    external_account_id VARCHAR(32),
    name VARCHAR(64) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    overdraft_facility NUMERIC(10,2) NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0)
);
CREATE INDEX external_account_id_idx ON account (external_account_id);

CREATE TRIGGER set_created_at_account
    BEFORE INSERT ON account
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_account
    BEFORE UPDATE ON account
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE account_import (
    import_id INT NOT NULL,
    account_id INT NOT NULL REFERENCES account (account_id),
    total INT,
    progress INT,
    finished BOOLEAN NOT NULL DEFAULT FALSE,
    original_data TEXT,
    json_data TEXT,
    json_normalized_data TEXT,
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0),
    PRIMARY KEY(import_id, account_id)
);

CREATE TRIGGER set_created_at_account_import
    BEFORE INSERT ON account_import
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_account_import
    BEFORE UPDATE ON account_import
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE shared_account (
    account_id INT NOT NULL REFERENCES account (account_id),
    member_id INT NOT NULL REFERENCES member (member_id),
    PRIMARY KEY(account_id, member_id)
);

CREATE TABLE scheduler (
    scheduler_id SERIAL PRIMARY KEY,
    account_id INT NOT NULL REFERENCES account (account_id),
    transfer_account_id INT REFERENCES account (account_id),
    category_id INT REFERENCES category (category_id),
    payment_method_id INT NOT NULL REFERENCES payment_method (payment_method_id),
    third_party VARCHAR(64) NOT NULL,
    debit NUMERIC(10,2),
    credit NUMERIC(10,2),
    value_date DATE NOT NULL,
    limit_date DATE,
    is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    frequency_unit VARCHAR(16) NOT NULL DEFAULT 'month' CHECK (frequency_unit IN ('day', 'week', 'month', 'year')),
    frequency_value SMALLINT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0),
    CHECK (debit IS NOT NULL OR credit IS NOT NULL)
);

CREATE TRIGGER set_created_at_scheduler
    BEFORE INSERT ON scheduler
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_scheduler
    BEFORE UPDATE ON scheduler
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE operation (
    operation_id SERIAL PRIMARY KEY,
    scheduler_id INT REFERENCES scheduler (scheduler_id),
    account_id INT NOT NULL REFERENCES account (account_id),
    transfer_account_id INT REFERENCES account (account_id),
    transfer_operation_id INT UNIQUE REFERENCES operation (operation_id) ON DELETE SET NULL,
    category_id INT REFERENCES category (category_id),
    payment_method_id INT NOT NULL REFERENCES payment_method (payment_method_id),
    external_operation_id VARCHAR(32),
    third_party VARCHAR(64) NOT NULL,
    debit NUMERIC(10,2),
    credit NUMERIC(10,2),
    value_date DATE NOT NULL,
    is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0),
    CHECK (debit IS NOT NULL OR credit IS NOT NULL)
);
CREATE INDEX external_operation_id_idx ON operation (external_operation_id);

CREATE TRIGGER set_created_at_operation
    BEFORE INSERT ON operation
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_operation
    BEFORE UPDATE ON operation
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE operation_search (
    operation_search_id SERIAL PRIMARY KEY,
    account_id INT NOT NULL REFERENCES account (account_id),
    third_party VARCHAR(64),
    notes VARCHAR(128),
    value_date_start DATE,
    value_date_end DATE,
    is_reconciled BOOLEAN,
    type VARCHAR(8) DEFAULT 'debit' CHECK (type IN ('debit', 'credit')),
    amount_inferior_to NUMERIC(10,2),
    amount_inferior_or_equal_to NUMERIC(10,2),
    amount_equal_to NUMERIC(10,2),
    amount_superior_or_equal_to NUMERIC(10,2),
    amount_superior_to NUMERIC(10,2),
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0)
);

CREATE TRIGGER set_created_at_operation_search
    BEFORE INSERT ON operation_search
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_operation_search
    BEFORE UPDATE ON operation_search
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE operation_search_category (
    operation_search_id INT NOT NULL REFERENCES operation_search (operation_search_id),
    category_id INT NOT NULL REFERENCES category (category_id),
    PRIMARY KEY(operation_search_id, category_id)
);

CREATE TABLE operation_search_payment_method (
    operation_search_id INT NOT NULL REFERENCES operation_search (operation_search_id),
    payment_method_id INT NOT NULL REFERENCES payment_method (payment_method_id),
    PRIMARY KEY(operation_search_id, payment_method_id)
);

CREATE TABLE report (
    report_id SERIAL PRIMARY KEY,
    member_id INT NOT NULL REFERENCES member (member_id),
    type VARCHAR(16) NOT NULL CHECK (type IN ('sum', 'average', 'distribution', 'estimate')),
    title VARCHAR(64) NOT NULL,
    homepage BOOLEAN NOT NULL DEFAULT FALSE,
    value_date_start DATE,
    value_date_end DATE,
    third_parties VARCHAR(255),
    reconciled_only BOOLEAN,
    period_grouping VARCHAR(8) CHECK (period_grouping IN ('month', 'quarter', 'year', 'all')),
    data_grouping VARCHAR(16) CHECK (data_grouping IN ('category', 'third_party', 'payment_method')),
    significant_results_number SMALLINT,
    month_expenses INT,
    month_incomes INT,
    estimate_duration_value SMALLINT,
    estimate_duration_unit VARCHAR(8) CHECK (estimate_duration_unit IN ('month', 'year')),
    created_at TIMESTAMP(0) NOT NULL,
    updated_at TIMESTAMP(0)
);

CREATE TRIGGER set_created_at_report
    BEFORE INSERT ON report
    FOR EACH ROW
    EXECUTE PROCEDURE set_created_at();

CREATE TRIGGER set_updated_at_report
    BEFORE UPDATE ON report
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TABLE report_category (
    report_id INT NOT NULL REFERENCES report (report_id),
    category_id INT NOT NULL REFERENCES category (category_id),
    PRIMARY KEY(report_id, category_id)
);

CREATE TABLE report_payment_method (
    report_id INT NOT NULL REFERENCES report (report_id),
    payment_method_id INT NOT NULL REFERENCES payment_method (payment_method_id),
    PRIMARY KEY(report_id, payment_method_id)
);

CREATE TABLE report_account (
    report_id INT NOT NULL REFERENCES report (report_id),
    account_id INT NOT NULL REFERENCES account (account_id),
    PRIMARY KEY(report_id, account_id)
);
