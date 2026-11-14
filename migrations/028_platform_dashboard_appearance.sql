CREATE TABLE IF NOT EXISTS platform_dashboard_appearance (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  primary_color text NOT NULL DEFAULT '#F6B900' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text NOT NULL DEFAULT '#14E6FF' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text NOT NULL DEFAULT '#020713' CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  surface_color text NOT NULL DEFAULT '#07111F' CHECK (surface_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_color text NOT NULL DEFAULT '#FFFAF0' CHECK (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  muted_color text NOT NULL DEFAULT '#C7BEA8' CHECK (muted_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_style text NOT NULL DEFAULT 'orbital' CHECK (background_style IN ('orbital', 'grid', 'aurora')),
  interface_style text NOT NULL DEFAULT 'command' CHECK (interface_style IN ('command', 'executive', 'minimal')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_dashboard_appearance(singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;
