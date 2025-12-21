-- Fix security linter WARN: set immutable search_path for trigger functions

create or replace function public.notify_on_item_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Check if approval status changed
  if old.approval_status is distinct from new.approval_status then
    if new.approval_status = 'approved' then
      insert into notifications (user_id, type, title, message, data)
      values (
        new.created_by,
        'item_status',
        'Item Approved',
        'Your ' || tg_table_name || ' "' || new.name || '" has been approved and is now visible to users.',
        jsonb_build_object('item_id', new.id, 'item_type', tg_table_name, 'status', 'approved')
      );
    elsif new.approval_status = 'rejected' then
      insert into notifications (user_id, type, title, message, data)
      values (
        new.created_by,
        'item_status',
        'Item Rejected',
        'Your ' || tg_table_name || ' "' || new.name || '" was not approved. Please review and resubmit.',
        jsonb_build_object('item_id', new.id, 'item_type', tg_table_name, 'status', 'rejected')
      );
    end if;
  end if;

  -- Check if item was hidden or unhidden
  if old.is_hidden is distinct from new.is_hidden then
    if new.is_hidden = true then
      insert into notifications (user_id, type, title, message, data)
      values (
        new.created_by,
        'item_hidden',
        'Item Hidden from Public View',
        'Your ' || tg_table_name || ' "' || new.name || '" has been hidden from public view.',
        jsonb_build_object('item_id', new.id, 'item_type', tg_table_name, 'is_hidden', true)
      );
    elsif new.is_hidden = false and old.is_hidden = true then
      insert into notifications (user_id, type, title, message, data)
      values (
        new.created_by,
        'item_unhidden',
        'Item Returned to Public View',
        'Your ' || tg_table_name || ' "' || new.name || '" is now visible to the public again.',
        jsonb_build_object('item_id', new.id, 'item_type', tg_table_name, 'is_hidden', false)
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.notify_on_attraction_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Check if approval status changed
  if old.approval_status is distinct from new.approval_status then
    if new.approval_status = 'approved' then
      insert into notifications (user_id, type, title, message, data)
      values (
        new.created_by,
        'item_status',
        'Attraction Approved',
        'Your attraction "' || new.location_name || '" has been approved and is now visible to users.',
        jsonb_build_object('item_id', new.id, 'item_type', 'attractions', 'status', 'approved')
      );
    elsif new.approval_status = 'rejected' then
      insert into notifications (user_id, type, title, message, data)
      values (
        new.created_by,
        'item_status',
        'Attraction Rejected',
        'Your attraction "' || new.location_name || '" was not approved. Please review and resubmit.',
        jsonb_build_object('item_id', new.id, 'item_type', 'attractions', 'status', 'rejected')
      );
    end if;
  end if;

  -- Check if item was hidden or unhidden
  if old.is_hidden is distinct from new.is_hidden then
    if new.is_hidden = true then
      insert into notifications (user_id, type, title, message, data)
      values (
        new.created_by,
        'item_hidden',
        'Attraction Hidden from Public View',
        'Your attraction "' || new.location_name || '" has been hidden from public view.',
        jsonb_build_object('item_id', new.id, 'item_type', 'attractions', 'is_hidden', true)
      );
    elsif new.is_hidden = false and old.is_hidden = true then
      insert into notifications (user_id, type, title, message, data)
      values (
        new.created_by,
        'item_unhidden',
        'Attraction Returned to Public View',
        'Your attraction "' || new.location_name || '" is now visible to the public again.',
        jsonb_build_object('item_id', new.id, 'item_type', 'attractions', 'is_hidden', false)
      );
    end if;
  end if;

  return new;
end;
$$;
