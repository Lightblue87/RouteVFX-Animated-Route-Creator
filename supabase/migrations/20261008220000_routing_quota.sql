-- Tages-Kontingente für den Routing-Proxy (Edge Function „route“).
-- Gespeichert wird nur ein täglich wechselnder Hash der Client-IP und ein Zähler – keine Koordinaten.
-- Zugriff ausschließlich über die Service-Rolle (RLS aktiv, keine Policies).

create table if not exists public.routing_usage (
  day date not null,
  client_key text not null,
  count integer not null default 0 check (count >= 0),
  primary key (day, client_key)
);

alter table public.routing_usage enable row level security;
revoke all on table public.routing_usage from anon, authenticated;

create or replace function public.routing_take_quota(p_key text, p_per_key integer, p_global integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_client integer;
begin
  -- Serialisiert gleichzeitige Aufrufe, damit das Gesamtkontingent nicht überschritten wird.
  perform pg_advisory_xact_lock(hashtext('routing_take_quota'));
  -- Datensparsamkeit: Zähler älter als 7 Tage löschen.
  delete from routing_usage where day < current_date - 7;

  select coalesce(sum(count), 0) into v_total from routing_usage where day = current_date;
  if v_total >= p_global then
    return false;
  end if;

  select count into v_client from routing_usage where day = current_date and client_key = p_key;
  if coalesce(v_client, 0) >= p_per_key then
    return false;
  end if;

  insert into routing_usage (day, client_key, count) values (current_date, p_key, 1)
  on conflict (day, client_key) do update set count = routing_usage.count + 1;
  return true;
end;
$$;

revoke execute on function public.routing_take_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.routing_take_quota(text, integer, integer) to service_role;
