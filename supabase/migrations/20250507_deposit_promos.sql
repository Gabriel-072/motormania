-- 1) Wallet: saldos bloqueados + flag
alter table wallet
  add column if not exists locked_mmc  numeric default 0,
  add column if not exists locked_fuel numeric default 0,
  add column if not exists first_deposit_bonus_applied boolean default false;

-- 2) Config table (editable vía Supabase UI)
create table if not exists deposit_promos (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_active boolean default false,
  -- type = 'multiplier' => factor 2, 3, etc.
  -- type = 'percentage' => 100, 200 (%)
  type text check (type in ('multiplier','percentage')),
  factor numeric,              -- ej. 3  (triplicar)  o 100 (100 %)
  min_deposit numeric,         -- COP
  max_bonus_mmc numeric,       -- tope en MMC
  max_bonus_fuel numeric,      -- tope en Fuel
  start_at timestamp,
  end_at timestamp,
  created_at timestamp default now()
);

-- 3) Tabla por usuario
create table if not exists promotions_user (
  id uuid primary key default gen_random_uuid(),
  user_id text references clerk_users(clerk_id),
  promo_id uuid references deposit_promos(id),
  locked_amount_mmc  numeric,
  locked_amount_fuel numeric,
  wager_remaining_mmc numeric,
  status text,   -- active | completed | expired
  created_at timestamp default now(),
  expires_at timestamp
);

-- 4) RPC para aplicar la promo dinámica
create or replace function apply_deposit_promo(
  user_id text,
  amount_cop numeric)
returns void language plpgsql as $$
declare
  promo record;
  deposit_mmc  numeric := floor(amount_cop / 1000);  -- 1 000 COP = 1 MMC
  deposit_fuel numeric := amount_cop;                -- 1 COP  = 1 Fuel
  bonus_mmc numeric;
  bonus_fuel numeric;
  wager_req numeric;
begin
  -- Obtener promo activa dentro de fecha, priorizar la más reciente
  select * into promo
    from deposit_promos
   where is_active
     and (start_at is null or start_at <= now())
     and (end_at   is null or end_at   >= now())
   order by start_at desc nulls last
   limit 1;

  -- Si no hay promo o depósito menor al mínimo → solo acreditar depósito base
  if promo is null or amount_cop < promo.min_deposit then
    update wallet
      set mmc_coins  = mmc_coins  + deposit_mmc,
          fuel_coins = fuel_coins + deposit_fuel
      where user_id = apply_deposit_promo.user_id;
    return;
  end if;

  -- Calcular BONUS según tipo
  if promo.type = 'multiplier' then
    bonus_mmc  := deposit_mmc  * (promo.factor - 1);
    bonus_fuel := deposit_fuel * (promo.factor - 1);
  else -- percentage
    bonus_mmc  := deposit_mmc  * (promo.factor / 100);
    bonus_fuel := deposit_fuel * (promo.factor / 100);
  end if;

  -- Aplicar topes
  bonus_mmc  := least(bonus_mmc,  promo.max_bonus_mmc);
  bonus_fuel := least(bonus_fuel, promo.max_bonus_fuel);

  -- 1. acreditar depósito base
  update wallet
    set mmc_coins  = mmc_coins  + deposit_mmc,
        fuel_coins = fuel_coins + deposit_fuel
    where user_id = apply_deposit_promo.user_id;

  -- 2. bloquear bonus
  update wallet
    set locked_mmc  = locked_mmc  + bonus_mmc,
        locked_fuel = locked_fuel + bonus_fuel,
        first_deposit_bonus_applied = true
    where user_id = apply_deposit_promo.user_id;

  -- 3. registrar promoción
  wager_req := deposit_mmc + bonus_mmc;  -- play-through = dep + bonus
  insert into promotions_user
    (user_id, promo_id, locked_amount_mmc, locked_amount_fuel,
     wager_remaining_mmc, status, expires_at)
  values
    (user_id, promo.id, bonus_mmc, bonus_fuel,
     wager_req, 'active', now() + interval '30 days');
end;
$$;

-- 5) RPC para consumir MMC bloqueados
create or replace function consume_locked_mmc(
  user_id text,
  bet_mmc numeric)
returns void language plpgsql as $$
declare
  remaining numeric := bet_mmc;
  promo record;
begin
  -- Prioriza MMC bloqueados
  update wallet
    set locked_mmc = greatest(locked_mmc - remaining, 0)
    where user_id = consume_locked_mmc.user_id
    returning locked_mmc into remaining;

  remaining := greatest(remaining, 0);

  update wallet
    set mmc_coins = mmc_coins - remaining
    where user_id = consume_locked_mmc.user_id;

  -- Reducir wager restante
  select * into promo
    from promotions_user
   where user_id = consume_locked_mmc.user_id
     and status = 'active'
   order by created_at desc
   limit 1;

  if promo is not null then
    update promotions_user
      set wager_remaining_mmc = greatest(wager_remaining_mmc - bet_mmc, 0)
      where id = promo.id;

    -- ¿Cumplió play-through? → libera Fuel
    if promo.wager_remaining_mmc - bet_mmc <= 0 then
      update wallet
        set fuel_coins = fuel_coins + locked_fuel,
            locked_fuel = 0
        where user_id = consume_locked_mmc.user_id;

      update promotions_user
        set status = 'completed'
        where id = promo.id;
    end if;
  end if;
end;
$$;