-- Trip planning joins a 1.4M row schedule table; a cold cache can exceed the
-- default 3s budget and surface as a failed screen. Give reads a little room.
ALTER ROLE anon SET statement_timeout = '10s';
ALTER ROLE authenticated SET statement_timeout = '10s';
NOTIFY pgrst, 'reload config';