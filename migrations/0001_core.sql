CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  display_name TEXT,
  company_type TEXT,
  primary_contact_name TEXT NOT NULL,
  primary_contact_email TEXT NOT NULL,
  billing_contact_email TEXT,
  country TEXT NOT NULL,
  region TEXT,
  city TEXT,
  postal_code TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL,
  auth_subject TEXT NOT NULL,
  company_id TEXT,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE UNIQUE INDEX idx_users_auth_identity ON users(auth_provider, auth_subject);
CREATE INDEX idx_users_company_id ON users(company_id);
