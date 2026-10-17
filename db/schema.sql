-- KAFAGU TECH PROSPEROUS — final schema draft
-- Run only after source code is finalized. PostgreSQL / Neon.
BEGIN;
CREATE TABLE IF NOT EXISTS app_users (
 id BIGSERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','dispatcher','technician')),
 is_active BOOLEAN NOT NULL DEFAULT TRUE, last_login_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customers (
 id BIGSERIAL PRIMARY KEY, customer_code TEXT UNIQUE, name TEXT NOT NULL,
 company_name TEXT, phone TEXT, email TEXT, address TEXT NOT NULL, city TEXT, notes TEXT,
 created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS work_orders (
 id BIGSERIAL PRIMARY KEY, spk_number TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT,
 service_type TEXT NOT NULL, customer_id BIGINT REFERENCES customers(id) ON DELETE RESTRICT,
 assigned_to BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
 created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
 work_date DATE NOT NULL, start_time TIME, end_time TIME, location TEXT NOT NULL,
 priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','assigned','in_progress','report_submitted','revision_required','completed','cancelled')),
 progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
 admin_notes TEXT, completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)
);
CREATE TABLE IF NOT EXISTS progress_logs (
 id BIGSERIAL PRIMARY KEY, work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
 technician_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 progress_percent INTEGER NOT NULL CHECK (progress_percent BETWEEN 0 AND 100), note TEXT NOT NULL,
 logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS work_photos (
 id BIGSERIAL PRIMARY KEY, work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
 uploaded_by BIGINT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 photo_type TEXT NOT NULL CHECK (photo_type IN ('before','during','after')),
 file_url TEXT NOT NULL, file_name TEXT, mime_type TEXT, file_size_bytes BIGINT,
 caption TEXT, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS work_reports (
 id BIGSERIAL PRIMARY KEY, work_order_id BIGINT NOT NULL UNIQUE REFERENCES work_orders(id) ON DELETE CASCADE,
 submitted_by BIGINT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 work_summary TEXT NOT NULL, materials_used JSONB NOT NULL DEFAULT '[]'::jsonb,
 checklist JSONB NOT NULL DEFAULT '[]'::jsonb, issues_found TEXT, recommendations TEXT,
 customer_name_signed TEXT, customer_signature_url TEXT, customer_confirmed_at TIMESTAMPTZ,
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS report_reviews (
 id BIGSERIAL PRIMARY KEY, work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
 report_id BIGINT NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
 reviewer_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 decision TEXT NOT NULL CHECK (decision IN ('approved','revision_required')),
 reason TEXT, revision_number INTEGER NOT NULL DEFAULT 1, reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (decision <> 'revision_required' OR length(trim(COALESCE(reason,''))) > 0)
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGSERIAL PRIMARY KEY, actor_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
 action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, details JSONB NOT NULL DEFAULT '{}'::jsonb,
 ip_address TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_users_role_active ON app_users(role,is_active);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_work_orders_date_status ON work_orders(work_date,status);
CREATE INDEX IF NOT EXISTS idx_work_orders_assignee_date ON work_orders(assigned_to,work_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_order ON progress_logs(work_order_id,logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_photos_order ON work_photos(work_order_id,uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_reviews_order ON report_reviews(work_order_id,reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_app_users_updated ON app_users;
CREATE TRIGGER trg_app_users_updated BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_customers_updated ON customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_work_orders_updated ON work_orders;
CREATE TRIGGER trg_work_orders_updated BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_work_reports_updated ON work_reports;
CREATE TRIGGER trg_work_reports_updated BEFORE UPDATE ON work_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMIT;
