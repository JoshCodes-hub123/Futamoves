-- Restore Smart Dispatch singleton settings row (lost in remix; defaults from 0009).
INSERT INTO public.dispatch_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
