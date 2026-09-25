-- =============================================
-- PONTO ELETRÔNICO: validação de sequência e geofence (trigger)
-- =============================================
-- BEFORE INSERT em registros_ponto: garante que o horário é o do servidor, que
-- a sequência entrada -> (inicio_intervalo -> fim_intervalo)* -> saida é
-- respeitada (olhando o último ponto do funcionário, não só "hoje", para cobrir
-- turnos que cruzam a meia-noite), e que a batida está dentro do raio de algum
-- local de ponto atribuído ao funcionário. Como este trigger roda BEFORE ROW, a
-- policy de RLS (WITH CHECK) avalia a linha já validada/preenchida - o cliente
-- não consegue influenciar user_id, momento ou o resultado do geofence.
-- Mantido em migration separada da tabela para revisão/reversão independente.

CREATE OR REPLACE FUNCTION public.validar_registro_ponto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_ultimo_tipo public.tipo_ponto;
  v_local RECORD;
  v_distancia NUMERIC;
  v_menor_distancia NUMERIC;
  v_local_mais_proximo UUID;
  v_dentro_raio BOOLEAN;
BEGIN
  -- Servidor é sempre a autoridade do horário oficial do ponto; o horário do
  -- dispositivo do cliente (se enviado) fica só em device_timestamp, informativo.
  NEW.momento := now();
  NEW.created_at := now();

  -- Preenche o dono (gestor) a partir do funcionário - nunca confia no cliente.
  SELECT user_id INTO v_owner_id FROM public.funcionarios WHERE id = NEW.funcionario_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário inválido';
  END IF;
  NEW.user_id := v_owner_id;

  -- Máquina de estados: entrada -> (inicio_intervalo -> fim_intervalo)* -> saida
  SELECT tipo INTO v_ultimo_tipo
  FROM public.registros_ponto
  WHERE funcionario_id = NEW.funcionario_id
  ORDER BY momento DESC
  LIMIT 1;

  IF v_ultimo_tipo IS NULL THEN
    IF NEW.tipo <> 'entrada' THEN
      RAISE EXCEPTION 'Primeira batida do funcionário deve ser "entrada"';
    END IF;
  ELSIF v_ultimo_tipo = 'entrada' AND NEW.tipo NOT IN ('inicio_intervalo', 'saida') THEN
    RAISE EXCEPTION 'Após "entrada", a próxima batida deve ser "inicio_intervalo" ou "saida"';
  ELSIF v_ultimo_tipo = 'inicio_intervalo' AND NEW.tipo <> 'fim_intervalo' THEN
    RAISE EXCEPTION 'Após "inicio_intervalo", a próxima batida deve ser "fim_intervalo"';
  ELSIF v_ultimo_tipo = 'fim_intervalo' AND NEW.tipo NOT IN ('inicio_intervalo', 'saida') THEN
    RAISE EXCEPTION 'Após "fim_intervalo", a próxima batida deve ser "inicio_intervalo" ou "saida"';
  ELSIF v_ultimo_tipo = 'saida' AND NEW.tipo <> 'entrada' THEN
    RAISE EXCEPTION 'Após "saida", a próxima batida deve ser "entrada"';
  END IF;

  -- Geofence: encontra, entre os locais atribuídos e ativos do funcionário, o
  -- mais próximo da posição informada.
  v_menor_distancia := NULL;
  v_local_mais_proximo := NULL;
  v_dentro_raio := false;

  FOR v_local IN
    SELECT lp.id, lp.latitude, lp.longitude, lp.raio_metros
    FROM public.locais_ponto lp
    JOIN public.funcionario_locais_ponto flp ON flp.local_ponto_id = lp.id
    WHERE flp.funcionario_id = NEW.funcionario_id
      AND lp.ativo = true
      AND flp.data_inicio <= CURRENT_DATE
      AND (flp.data_fim IS NULL OR flp.data_fim >= CURRENT_DATE)
  LOOP
    v_distancia := public.calcular_distancia_metros(NEW.latitude, NEW.longitude, v_local.latitude, v_local.longitude);
    IF v_menor_distancia IS NULL OR v_distancia < v_menor_distancia THEN
      v_menor_distancia := v_distancia;
      v_local_mais_proximo := v_local.id;
      v_dentro_raio := v_distancia <= v_local.raio_metros;
    END IF;
  END LOOP;

  IF v_local_mais_proximo IS NULL THEN
    RAISE EXCEPTION 'Nenhum local de ponto está cadastrado para este funcionário. Peça ao gestor para cadastrar um local em "Locais de Ponto".';
  END IF;

  NEW.local_ponto_id := v_local_mais_proximo;
  NEW.distancia_metros := v_menor_distancia;
  NEW.dentro_raio := v_dentro_raio;

  IF NOT v_dentro_raio THEN
    RAISE EXCEPTION 'Você está a % metros do local de ponto mais próximo, fora do raio permitido.', round(v_menor_distancia);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validar_registro_ponto_trigger
  BEFORE INSERT ON public.registros_ponto
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_registro_ponto();
