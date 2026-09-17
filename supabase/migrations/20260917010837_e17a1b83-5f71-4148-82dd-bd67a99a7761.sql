ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.import_estoque_aplicar(uuid) SECURITY INVOKER;
ALTER FUNCTION public.import_estoque_resumo(uuid) SECURITY INVOKER;

CREATE POLICY "Servico interno gerencia importacao legada"
ON public.importacao_francy
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);