-- Minutenlimit für den Routing-Proxy: Der openrouteservice-Standard-Plan erlaubt 40 Routenanfragen je 60 Sekunden
-- (gleitendes Fenster, mit dem HeiGIT-Dashboard belegt). Die Tageskontingente allein verhindern nicht, dass mehrere
-- Nutzer gleichzeitig dieses Limit reißen. Die Funktion zählt deshalb zusätzlich die zugelassenen Anfragen der
-- letzten 60 Sekunden. Gespeichert werden nur Zeitstempel (keine Client-Schlüssel, keine Koordinaten); Einträge
-- werden nach 10 Minuten gelöscht.
--
-- Rückwärtskompatibel: p_per_minute ist optional. Eine bereits deployte Edge-Function-Version, die nur drei
-- Parameter sendet, funktioniert unverändert (dann ohne Minutenlimit).

create table if not exists public.routing_recent (
  ts timestamptz not null default now()
);
create index if not exists routing_recent_ts_idx on public.routing_recent (ts);
alter table public.routing_recent enable row level security;
revoke all on table public.routing_recent from anon, authenticated;

-- Die alte Drei-Parameter-Version entfernen, sonst wäre der RPC-Aufruf mit drei Parametern mehrdeutig.
drop function if exists public.routing_take_quota(text, integer, integer);

create or replace function public.routing_take_quota(p_key text, p_per_key integer, p_global integer, p_per_minute integer default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_client integer;
  v_recent integer;
begin
  -- Serialisiert gleichzeitige Aufrufe, damit die Kontingente nicht überschritten werden.
  perform pg_advisory_xact_lock(hashtext('routing_take_quota'));
  -- Datensparsamkeit: alte Zähler und Zeitstempel löschen.
  delete from routing_usage where day < current_date - 7;
  delete from routing_recent where ts < now() - interval '10 minutes';

  select coalesce(sum(count), 0) into v_total from routing_usage where day = current_date;
  if v_total >= p_global then
    return false;
  end if;

  select count into v_client from routing_usage where day = current_date and client_key = p_key;
  if coalesce(v_client, 0) >= p_per_key then
    return false;
  end if;

  if p_per_minute is not null then
    select count(*) into v_recent from routing_recent where ts > now() - interval '60 seconds';
    if v_recent >= p_per_minute then
      return false; -- abgelehnte Anfragen zählen nicht gegen das Tageskontingent
    end if;
  end if;

  insert into routing_usage (day, client_key, count) values (current_date, p_key, 1)
  on conflict (day, client_key) do update set count = routing_usage.count + 1;
  insert into routing_recent default values;
  return true;
end;
$$;

revoke execute on function public.routing_take_quota(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.routing_take_quota(text, integer, integer, integer) to service_role;
