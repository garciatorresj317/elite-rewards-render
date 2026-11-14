CREATE TABLE IF NOT EXISTS service_plan_templates (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  active boolean NOT NULL DEFAULT true,
  billing_interval text NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  billing_amount_cents integer NOT NULL CHECK (billing_amount_cents >= 0 AND billing_amount_cents <= 100000000),
  term_months integer NOT NULL CHECK (term_months BETWEEN 1 AND 120),
  nfc_card_quantity integer NOT NULL CHECK (nfc_card_quantity BETWEEN 0 AND 10000),
  included_services text NOT NULL CHECK (char_length(included_services) BETWEEN 1 AND 5000),
  payment_terms text NOT NULL CHECK (char_length(payment_terms) BETWEEN 1 AND 3000),
  upgrade_terms text NOT NULL CHECK (char_length(upgrade_terms) BETWEEN 1 AND 3000),
  termination_terms text NOT NULL CHECK (char_length(termination_terms) BETWEEN 1 AND 5000),
  auto_renews boolean NOT NULL DEFAULT false,
  created_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, version),
  CHECK (billing_interval <> 'yearly' OR term_months % 12 = 0)
);

INSERT INTO service_plan_templates(
  id, name, version, billing_interval, billing_amount_cents, term_months,
  nfc_card_quantity, included_services, payment_terms, upgrade_terms,
  termination_terms, auto_renews
) VALUES (
  'plan_custom_v1', 'Custom Plan', 1, 'monthly', 6000, 12, 4,
  'Four programmed NFC cards; Elite Rewards program access; initial custom configuration; monthly maintenance; reasonable technical support; and routine service updates during the term.',
  'The first payment is due on the Effective Date and each later payment is due on the same calendar day of each following billing period. Amounts more than 10 days late may result in service suspension after written notice. Payment obligations accrued before suspension or termination remain due.',
  'Client may request an upgrade at any time. An upgrade becomes effective only through a written amendment or replacement order accepted by both parties. Any added fees, services, equipment, and changed term will be stated in that amendment; no downgrade or upgrade cancels amounts already due unless the amendment expressly says so.',
  'This Agreement is a fixed-term commitment. Either party may terminate for a material breach that remains uncured 15 days after written notice. Client remains responsible for charges accrued through the termination date and, except where Provider materially breaches, the unpaid balance of the committed term. Sections concerning payment, confidentiality, intellectual property, warranty limitations, liability, disputes, and records survive termination.',
  false
) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS service_contracts (
  id text PRIMARY KEY,
  contract_number text NOT NULL UNIQUE,
  agreement_type text NOT NULL DEFAULT 'initial' CHECK (agreement_type IN ('initial', 'amendment', 'renewal')),
  parent_contract_id text REFERENCES service_contracts(id) ON DELETE RESTRICT,
  linked_business_id text REFERENCES businesses(id) ON DELETE RESTRICT,
  plan_template_id text REFERENCES service_plan_templates(id) ON DELETE RESTRICT,
  plan_template_version integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'void')),
  provider_legal_name text NOT NULL DEFAULT '' CHECK (char_length(provider_legal_name) <= 160),
  provider_address text NOT NULL DEFAULT '' CHECK (char_length(provider_address) <= 500),
  provider_email text NOT NULL DEFAULT '' CHECK (char_length(provider_email) <= 254),
  provider_signer_name text NOT NULL DEFAULT '' CHECK (char_length(provider_signer_name) <= 120),
  provider_signer_title text NOT NULL DEFAULT '' CHECK (char_length(provider_signer_title) <= 120),
  provider_signed_at timestamptz,
  provider_signer_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  client_legal_name text NOT NULL DEFAULT '' CHECK (char_length(client_legal_name) <= 160),
  client_address text NOT NULL DEFAULT '' CHECK (char_length(client_address) <= 500),
  client_signer_name text NOT NULL DEFAULT '' CHECK (char_length(client_signer_name) <= 120),
  client_signer_title text NOT NULL DEFAULT '' CHECK (char_length(client_signer_title) <= 120),
  client_email text NOT NULL DEFAULT '' CHECK (char_length(client_email) <= 254),
  plan_name text NOT NULL CHECK (char_length(plan_name) BETWEEN 2 AND 120),
  billing_interval text NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  billing_amount_cents integer NOT NULL CHECK (billing_amount_cents >= 0 AND billing_amount_cents <= 100000000),
  term_months integer NOT NULL CHECK (term_months BETWEEN 1 AND 120),
  nfc_card_quantity integer NOT NULL CHECK (nfc_card_quantity BETWEEN 0 AND 10000),
  included_services text NOT NULL CHECK (char_length(included_services) BETWEEN 1 AND 5000),
  payment_terms text NOT NULL CHECK (char_length(payment_terms) BETWEEN 1 AND 3000),
  upgrade_terms text NOT NULL CHECK (char_length(upgrade_terms) BETWEEN 1 AND 3000),
  termination_terms text NOT NULL CHECK (char_length(termination_terms) BETWEEN 1 AND 5000),
  additional_terms text NOT NULL DEFAULT '' CHECK (char_length(additional_terms) <= 8000),
  auto_renews boolean NOT NULL DEFAULT false,
  governing_law text NOT NULL DEFAULT '' CHECK (char_length(governing_law) <= 100),
  venue text NOT NULL DEFAULT '' CHECK (char_length(venue) <= 200),
  effective_date date,
  agreement_locale text NOT NULL DEFAULT 'en' CHECK (agreement_locale IN ('en')),
  agreement_text text,
  agreement_sha256 text CHECK (agreement_sha256 IS NULL OR agreement_sha256 ~ '^[0-9a-f]{64}$'),
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_signature_name text CHECK (accepted_signature_name IS NULL OR char_length(accepted_signature_name) BETWEEN 2 AND 120),
  accepted_signature_title text CHECK (accepted_signature_title IS NULL OR char_length(accepted_signature_title) BETWEEN 2 AND 120),
  accepted_email text CHECK (accepted_email IS NULL OR char_length(accepted_email) <= 254),
  accepted_ip text CHECK (accepted_ip IS NULL OR char_length(accepted_ip) <= 100),
  accepted_user_agent text CHECK (accepted_user_agent IS NULL OR char_length(accepted_user_agent) <= 1000),
  electronic_consent boolean NOT NULL DEFAULT false,
  voided_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((agreement_type = 'initial' AND parent_contract_id IS NULL) OR (agreement_type <> 'initial' AND parent_contract_id IS NOT NULL)),
  CHECK (
    (status = 'draft' AND sent_at IS NULL AND accepted_at IS NULL AND voided_at IS NULL)
    OR (status = 'sent' AND sent_at IS NOT NULL AND accepted_at IS NULL AND voided_at IS NULL
        AND agreement_text IS NOT NULL AND agreement_sha256 IS NOT NULL
        AND provider_signed_at IS NOT NULL AND provider_signer_user_id IS NOT NULL)
    OR (status = 'accepted' AND sent_at IS NOT NULL AND accepted_at IS NOT NULL
        AND agreement_text IS NOT NULL AND agreement_sha256 IS NOT NULL
        AND provider_signed_at IS NOT NULL AND provider_signer_user_id IS NOT NULL
        AND accepted_signature_name IS NOT NULL AND accepted_signature_title IS NOT NULL
        AND accepted_email IS NOT NULL AND accepted_ip IS NOT NULL
        AND accepted_user_agent IS NOT NULL AND electronic_consent = true
        AND voided_at IS NULL)
    OR (status = 'void' AND voided_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS service_contract_tokens (
  id text PRIMARY KEY,
  contract_id text NOT NULL REFERENCES service_contracts(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  access_code_hash text NOT NULL CHECK (access_code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  viewed_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_contract_one_active_token_idx
  ON service_contract_tokens(contract_id)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS service_contract_events (
  id text PRIMARY KEY,
  contract_id text NOT NULL REFERENCES service_contracts(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('created','updated','issued','link_rotated','viewed','accepted','voided','amendment_created')),
  actor_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  agreement_sha256 text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_contracts_status_created_idx
  ON service_contracts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS service_contracts_client_email_idx
  ON service_contracts (lower(client_email), created_at DESC);
CREATE INDEX IF NOT EXISTS service_contracts_linked_business_idx
  ON service_contracts (linked_business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS service_contract_events_contract_idx
  ON service_contract_events (contract_id, created_at);

CREATE OR REPLACE FUNCTION protect_service_contract_records()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Service contract records cannot be deleted';
  END IF;
  IF OLD.sent_at IS NOT NULL AND (
    NEW.contract_number, NEW.agreement_type, NEW.parent_contract_id,
    NEW.provider_legal_name, NEW.provider_address, NEW.provider_email,
    NEW.provider_signer_name, NEW.provider_signer_title, NEW.provider_signed_at,
    NEW.client_legal_name, NEW.client_address, NEW.client_signer_name,
    NEW.client_signer_title, NEW.client_email, NEW.plan_name,
    NEW.billing_interval, NEW.billing_amount_cents, NEW.term_months,
    NEW.nfc_card_quantity, NEW.included_services, NEW.payment_terms,
    NEW.upgrade_terms, NEW.termination_terms, NEW.additional_terms,
    NEW.auto_renews, NEW.governing_law, NEW.venue, NEW.effective_date,
    NEW.agreement_locale, NEW.agreement_text, NEW.agreement_sha256
  ) IS DISTINCT FROM (
    OLD.contract_number, OLD.agreement_type, OLD.parent_contract_id,
    OLD.provider_legal_name, OLD.provider_address, OLD.provider_email,
    OLD.provider_signer_name, OLD.provider_signer_title, OLD.provider_signed_at,
    OLD.client_legal_name, OLD.client_address, OLD.client_signer_name,
    OLD.client_signer_title, OLD.client_email, OLD.plan_name,
    OLD.billing_interval, OLD.billing_amount_cents, OLD.term_months,
    OLD.nfc_card_quantity, OLD.included_services, OLD.payment_terms,
    OLD.upgrade_terms, OLD.termination_terms, OLD.additional_terms,
    OLD.auto_renews, OLD.governing_law, OLD.venue, OLD.effective_date,
    OLD.agreement_locale, OLD.agreement_text, OLD.agreement_sha256
  ) THEN
    RAISE EXCEPTION 'Issued service contract terms are immutable';
  END IF;
  IF OLD.status = 'accepted' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Accepted service contract records are immutable';
  END IF;
  IF OLD.status = 'void' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Voided service contract records are immutable';
  END IF;
  IF OLD.status = 'sent' AND NEW.status NOT IN ('accepted', 'void') THEN
    RAISE EXCEPTION 'An issued service contract can only be accepted or voided';
  END IF;
  IF NEW.status = 'sent' AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft service contract can be issued';
  END IF;
  IF NEW.status = 'accepted' AND OLD.status <> 'sent' THEN
    RAISE EXCEPTION 'Only an issued service contract can be accepted';
  END IF;
  IF NEW.status = 'void' AND OLD.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Only a draft or issued service contract can be voided';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS service_contract_record_protection ON service_contracts;
CREATE TRIGGER service_contract_record_protection
BEFORE UPDATE OR DELETE ON service_contracts
FOR EACH ROW EXECUTE FUNCTION protect_service_contract_records();

CREATE OR REPLACE FUNCTION prevent_contract_evidence_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Contract evidence records are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS service_contract_events_append_only ON service_contract_events;
CREATE TRIGGER service_contract_events_append_only
BEFORE UPDATE OR DELETE ON service_contract_events
FOR EACH ROW EXECUTE FUNCTION prevent_contract_evidence_change();

DROP TRIGGER IF EXISTS service_contract_tokens_no_delete ON service_contract_tokens;
CREATE TRIGGER service_contract_tokens_no_delete
BEFORE DELETE ON service_contract_tokens
FOR EACH ROW EXECUTE FUNCTION prevent_contract_evidence_change();
