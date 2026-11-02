-- Migration: 005_seed_initial_data.sql
-- Description: Seed general company career-resource recruiters (NOT GNDEC placement records)
--
-- CAUTION: These entries are general company career resources only.
-- They do NOT imply that these companies recruit at GNDEC.
-- verification_status applies only to company/resource identity
-- from the official career page, not to any GNDEC placement activity.

-- TATA CONSULTANCY SERVICES
INSERT INTO recruiters (id, name, description, website_url, data_source, source_url, verification_status)
VALUES (
    '22222222-2222-2222-2222-222222222222'::UUID,
    'Tata Consultancy Services',
    NULL,
    'https://www.tcs.com',
    'official',
    'https://careers.tcs.com',
    'verified'
) ON CONFLICT (id) DO NOTHING;

-- INFOSYS LIMITED
INSERT INTO recruiters (id, name, description, website_url, data_source, source_url, verification_status)
VALUES (
    '33333333-3333-3333-3333-333333333333'::UUID,
    'Infosys Limited',
    NULL,
    'https://www.infosys.com',
    'official',
    'https://www.infosys.com/careers',
    'verified'
) ON CONFLICT (id) DO NOTHING;

-- WIPRO LIMITED
INSERT INTO recruiters (id, name, description, website_url, data_source, source_url, verification_status)
VALUES (
    '44444444-4444-4444-4444-444444444444'::UUID,
    'Wipro Limited',
    NULL,
    'https://www.wipro.com',
    'official',
    'https://www.wipro.com/careers',
    'verified'
) ON CONFLICT (id) DO NOTHING;