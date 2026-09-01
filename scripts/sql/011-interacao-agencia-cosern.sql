-- Origem "Agência Cosern" no histórico do chamado.
--
-- O atendimento presencial na agência da concessionária vinha sendo lançado
-- como "Protocolo" ou "Visita técnica", o que embaralha duas coisas distintas:
-- ir à agência é um canal de contato, protocolo é o número que às vezes sai
-- dele. Com o valor próprio o histórico passa a dizer por onde o caso andou.
--
-- Entra antes de 'protocolo' na ordem do enum só para ficar junto dos demais
-- canais; a ordem do select na tela vem de ROTULO_TIPO_INTERACAO, não daqui.
--
-- Rodar no SQL Editor do Supabase e depois regerar src/lib/database.types.ts.

-- Fora de transação de propósito: ALTER TYPE ... ADD VALUE só fica utilizável
-- depois do commit.

alter type "TipoInteracaoChamado" add value if not exists 'agencia_cosern' before 'protocolo';
