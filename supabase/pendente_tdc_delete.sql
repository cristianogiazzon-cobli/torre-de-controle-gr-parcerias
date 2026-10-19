-- Função de exclusão de cliente (ainda NÃO aplicada no banco: o Supabase pede confirmação por conter DELETE).
-- Rode no SQL Editor do projeto torre-de-controle e confirme o aviso de comando destrutivo.
create or replace function public.tdc_delete(k text, cid text, usuario text) returns boolean
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  perform public.tdc_auth(k);
  select nome into nm from public.clientes where id = cid;
  if found then
    insert into public.historico (usuario, cliente_id, cliente, evento)
      values (coalesce(usuario, 'desconhecido'), cid, nm, 'Cliente excluído');
    delete from public.clientes where id = cid;
  end if;
  return true;
end $$;
revoke all on function public.tdc_delete(text, text, text) from public;
grant execute on function public.tdc_delete(text, text, text) to anon;
