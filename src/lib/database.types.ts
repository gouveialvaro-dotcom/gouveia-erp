export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      AlteracaoProgramacao: {
        Row: {
          alteradoEm: string
          alteradoPorId: string | null
          campo: string
          id: string
          motoristaAnteriorId: string | null
          programacaoId: string
          publicadaEm: string | null
          valorAnterior: string | null
          valorNovo: string | null
        }
        Insert: {
          alteradoEm?: string
          alteradoPorId?: string | null
          campo: string
          id?: string
          motoristaAnteriorId?: string | null
          programacaoId: string
          publicadaEm?: string | null
          valorAnterior?: string | null
          valorNovo?: string | null
        }
        Update: {
          alteradoEm?: string
          alteradoPorId?: string | null
          campo?: string
          id?: string
          motoristaAnteriorId?: string | null
          programacaoId?: string
          publicadaEm?: string | null
          valorAnterior?: string | null
          valorNovo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "AlteracaoProgramacao_alteradoPorId_fkey"
            columns: ["alteradoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AlteracaoProgramacao_motoristaAnteriorId_fkey"
            columns: ["motoristaAnteriorId"]
            isOneToOne: false
            referencedRelation: "Funcionario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AlteracaoProgramacao_programacaoId_fkey"
            columns: ["programacaoId"]
            isOneToOne: false
            referencedRelation: "ProgramacaoDiaria"
            referencedColumns: ["id"]
          },
        ]
      }
      Anexo: {
        Row: {
          criadoEm: string
          enviadoPorId: string
          id: string
          nomeArquivo: string
          oportunidadeId: string
          tipo: string | null
          url: string
        }
        Insert: {
          criadoEm?: string
          enviadoPorId: string
          id?: string
          nomeArquivo: string
          oportunidadeId: string
          tipo?: string | null
          url: string
        }
        Update: {
          criadoEm?: string
          enviadoPorId?: string
          id?: string
          nomeArquivo?: string
          oportunidadeId?: string
          tipo?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "Anexo_enviadoPorId_fkey"
            columns: ["enviadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Anexo_oportunidadeId_fkey"
            columns: ["oportunidadeId"]
            isOneToOne: false
            referencedRelation: "Oportunidade"
            referencedColumns: ["id"]
          },
        ]
      }
      AnexoChamado: {
        Row: {
          caminho: string
          chamadoId: string
          criadoEm: string
          enviadoPorId: string
          id: string
          nomeArquivo: string
          tamanho: number | null
          tipoMime: string | null
        }
        Insert: {
          caminho: string
          chamadoId: string
          criadoEm?: string
          enviadoPorId: string
          id?: string
          nomeArquivo: string
          tamanho?: number | null
          tipoMime?: string | null
        }
        Update: {
          caminho?: string
          chamadoId?: string
          criadoEm?: string
          enviadoPorId?: string
          id?: string
          nomeArquivo?: string
          tamanho?: number | null
          tipoMime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "AnexoChamado_chamadoId_fkey"
            columns: ["chamadoId"]
            isOneToOne: false
            referencedRelation: "Chamado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AnexoChamado_enviadoPorId_fkey"
            columns: ["enviadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      AnexoMensagem: {
        Row: {
          caminho: string
          criadoEm: string
          id: string
          mensagemId: string
          nomeArquivo: string
          tamanho: number | null
          tipoMime: string | null
        }
        Insert: {
          caminho: string
          criadoEm?: string
          id?: string
          mensagemId: string
          nomeArquivo: string
          tamanho?: number | null
          tipoMime?: string | null
        }
        Update: {
          caminho?: string
          criadoEm?: string
          id?: string
          mensagemId?: string
          nomeArquivo?: string
          tamanho?: number | null
          tipoMime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "AnexoMensagem_mensagemId_fkey"
            columns: ["mensagemId"]
            isOneToOne: false
            referencedRelation: "Mensagem"
            referencedColumns: ["id"]
          },
        ]
      }
      Chamado: {
        Row: {
          abertoEm: string
          atualizadoEm: string
          clienteId: string
          concluidoEm: string | null
          criadoEm: string
          criadoPorId: string | null
          descricao: string | null
          estagio: Database["public"]["Enums"]["EstagioChamado"]
          id: string
          numero: number
          obraId: string | null
          prazoLimite: string
          prioridade: Database["public"]["Enums"]["PrioridadeChamado"]
          protocoloConcessionaria: string | null
          responsavelId: string
          solucao: string | null
          tipoProblemaId: string
          titulo: string
          unidadeConsumidoraId: string | null
        }
        Insert: {
          abertoEm?: string
          atualizadoEm?: string
          clienteId: string
          concluidoEm?: string | null
          criadoEm?: string
          criadoPorId?: string | null
          descricao?: string | null
          estagio?: Database["public"]["Enums"]["EstagioChamado"]
          id?: string
          numero?: number
          obraId?: string | null
          prazoLimite: string
          prioridade?: Database["public"]["Enums"]["PrioridadeChamado"]
          protocoloConcessionaria?: string | null
          responsavelId: string
          solucao?: string | null
          tipoProblemaId: string
          titulo: string
          unidadeConsumidoraId?: string | null
        }
        Update: {
          abertoEm?: string
          atualizadoEm?: string
          clienteId?: string
          concluidoEm?: string | null
          criadoEm?: string
          criadoPorId?: string | null
          descricao?: string | null
          estagio?: Database["public"]["Enums"]["EstagioChamado"]
          id?: string
          numero?: number
          obraId?: string | null
          prazoLimite?: string
          prioridade?: Database["public"]["Enums"]["PrioridadeChamado"]
          protocoloConcessionaria?: string | null
          responsavelId?: string
          solucao?: string | null
          tipoProblemaId?: string
          titulo?: string
          unidadeConsumidoraId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Chamado_clienteId_fkey"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "Cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Chamado_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Chamado_obraId_fkey"
            columns: ["obraId"]
            isOneToOne: false
            referencedRelation: "Obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Chamado_responsavelId_fkey"
            columns: ["responsavelId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Chamado_tipoProblemaId_fkey"
            columns: ["tipoProblemaId"]
            isOneToOne: false
            referencedRelation: "TipoProblemaPosVenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Chamado_unidadeConsumidoraId_fkey"
            columns: ["unidadeConsumidoraId"]
            isOneToOne: false
            referencedRelation: "UnidadeConsumidora"
            referencedColumns: ["id"]
          },
        ]
      }
      Cliente: {
        Row: {
          atualizadoEm: string
          cidade: string | null
          cnpj: string
          contato: string | null
          criadoEm: string
          criadoPorId: string | null
          email: string | null
          endereco: string | null
          id: string
          manutencaoFim: string | null
          manutencaoInicio: string | null
          observacoes: string | null
          ramo: Database["public"]["Enums"]["RamoCliente"]
          razaoSocial: string
          telefone: string | null
          uf: string | null
        }
        Insert: {
          atualizadoEm?: string
          cidade?: string | null
          cnpj: string
          contato?: string | null
          criadoEm?: string
          criadoPorId?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          manutencaoFim?: string | null
          manutencaoInicio?: string | null
          observacoes?: string | null
          ramo?: Database["public"]["Enums"]["RamoCliente"]
          razaoSocial: string
          telefone?: string | null
          uf?: string | null
        }
        Update: {
          atualizadoEm?: string
          cidade?: string | null
          cnpj?: string
          contato?: string | null
          criadoEm?: string
          criadoPorId?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          manutencaoFim?: string | null
          manutencaoInicio?: string | null
          observacoes?: string | null
          ramo?: Database["public"]["Enums"]["RamoCliente"]
          razaoSocial?: string
          telefone?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Cliente_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Concessionaria: {
        Row: {
          ativo: boolean
          criadoEm: string
          id: string
          nome: string
          sigla: string | null
          uf: string | null
        }
        Insert: {
          ativo?: boolean
          criadoEm?: string
          id?: string
          nome: string
          sigla?: string | null
          uf?: string | null
        }
        Update: {
          ativo?: boolean
          criadoEm?: string
          id?: string
          nome?: string
          sigla?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      ContatoCliente: {
        Row: {
          cargo: string | null
          clienteId: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          cargo?: string | null
          clienteId: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          cargo?: string | null
          clienteId?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ContatoCliente_clienteId_fkey"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "Cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      Conversa: {
        Row: {
          criadaEm: string
          criadaPorId: string
          id: string
          obraId: string | null
          tipo: Database["public"]["Enums"]["TipoConversa"]
          titulo: string | null
        }
        Insert: {
          criadaEm?: string
          criadaPorId: string
          id?: string
          obraId?: string | null
          tipo: Database["public"]["Enums"]["TipoConversa"]
          titulo?: string | null
        }
        Update: {
          criadaEm?: string
          criadaPorId?: string
          id?: string
          obraId?: string | null
          tipo?: Database["public"]["Enums"]["TipoConversa"]
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Conversa_criadaPorId_fkey"
            columns: ["criadaPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Conversa_obraId_fkey"
            columns: ["obraId"]
            isOneToOne: false
            referencedRelation: "Obra"
            referencedColumns: ["id"]
          },
        ]
      }
      ConversaWhatsapp: {
        Row: {
          arquivadaEm: string | null
          arquivadaPorId: string | null
          atualizadoEm: string
          chamadoAtivoId: string | null
          clienteId: string | null
          contatoClienteId: string | null
          criadoEm: string
          donoId: string | null
          id: string
          iniciadaAtivamenteEm: string | null
          nomePerfil: string | null
          pendente: boolean
          telefone: string
          telefoneExibicao: string
          ultimaMensagemDirecao:
            | Database["public"]["Enums"]["DirecaoMensagemWhatsapp"]
            | null
          ultimaMensagemEm: string | null
        }
        Insert: {
          arquivadaEm?: string | null
          arquivadaPorId?: string | null
          atualizadoEm?: string
          chamadoAtivoId?: string | null
          clienteId?: string | null
          contatoClienteId?: string | null
          criadoEm?: string
          donoId?: string | null
          id?: string
          iniciadaAtivamenteEm?: string | null
          nomePerfil?: string | null
          pendente?: boolean
          telefone: string
          telefoneExibicao: string
          ultimaMensagemDirecao?:
            | Database["public"]["Enums"]["DirecaoMensagemWhatsapp"]
            | null
          ultimaMensagemEm?: string | null
        }
        Update: {
          arquivadaEm?: string | null
          arquivadaPorId?: string | null
          atualizadoEm?: string
          chamadoAtivoId?: string | null
          clienteId?: string | null
          contatoClienteId?: string | null
          criadoEm?: string
          donoId?: string | null
          id?: string
          iniciadaAtivamenteEm?: string | null
          nomePerfil?: string | null
          pendente?: boolean
          telefone?: string
          telefoneExibicao?: string
          ultimaMensagemDirecao?:
            | Database["public"]["Enums"]["DirecaoMensagemWhatsapp"]
            | null
          ultimaMensagemEm?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ConversaWhatsapp_arquivadaPorId_fkey"
            columns: ["arquivadaPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ConversaWhatsapp_chamadoAtivoId_fkey"
            columns: ["chamadoAtivoId"]
            isOneToOne: false
            referencedRelation: "Chamado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ConversaWhatsapp_clienteId_fkey"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "Cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ConversaWhatsapp_contatoClienteId_fkey"
            columns: ["contatoClienteId"]
            isOneToOne: false
            referencedRelation: "ContatoCliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ConversaWhatsapp_donoId_fkey"
            columns: ["donoId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      DescricaoPadrao: {
        Row: {
          atualizadoEm: string
          criadoEm: string
          criadoPorId: string | null
          id: string
          nome: string
          texto: string
          tipoProposta: Database["public"]["Enums"]["TipoProposta"]
        }
        Insert: {
          atualizadoEm?: string
          criadoEm?: string
          criadoPorId?: string | null
          id?: string
          nome: string
          texto: string
          tipoProposta: Database["public"]["Enums"]["TipoProposta"]
        }
        Update: {
          atualizadoEm?: string
          criadoEm?: string
          criadoPorId?: string | null
          id?: string
          nome?: string
          texto?: string
          tipoProposta?: Database["public"]["Enums"]["TipoProposta"]
        }
        Relationships: [
          {
            foreignKeyName: "DescricaoPadrao_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      EnvioWhatsapp: {
        Row: {
          criadoEm: string
          enviadoEm: string | null
          erro: string | null
          funcionarioId: string | null
          id: string
          mensagem: string
          papel: Database["public"]["Enums"]["PapelDestinatario"]
          status: string
          telefone: string
          tentativas: number
          urgente: boolean
          usuarioId: string | null
        }
        Insert: {
          criadoEm?: string
          enviadoEm?: string | null
          erro?: string | null
          funcionarioId?: string | null
          id?: string
          mensagem: string
          papel: Database["public"]["Enums"]["PapelDestinatario"]
          status?: string
          telefone: string
          tentativas?: number
          urgente?: boolean
          usuarioId?: string | null
        }
        Update: {
          criadoEm?: string
          enviadoEm?: string | null
          erro?: string | null
          funcionarioId?: string | null
          id?: string
          mensagem?: string
          papel?: Database["public"]["Enums"]["PapelDestinatario"]
          status?: string
          telefone?: string
          tentativas?: number
          urgente?: boolean
          usuarioId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "EnvioWhatsapp_funcionarioId_fkey"
            columns: ["funcionarioId"]
            isOneToOne: false
            referencedRelation: "Funcionario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EnvioWhatsapp_usuarioId_fkey"
            columns: ["usuarioId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Funcao: {
        Row: {
          ativo: boolean
          atualizadoEm: string
          criadoEm: string
          criadoPorId: string | null
          encargosPercent: number
          id: string
          nome: string
          salarioMensal: number
        }
        Insert: {
          ativo?: boolean
          atualizadoEm?: string
          criadoEm?: string
          criadoPorId?: string | null
          encargosPercent: number
          id?: string
          nome: string
          salarioMensal: number
        }
        Update: {
          ativo?: boolean
          atualizadoEm?: string
          criadoEm?: string
          criadoPorId?: string | null
          encargosPercent?: number
          id?: string
          nome?: string
          salarioMensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "Funcao_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Funcionario: {
        Row: {
          ativo: boolean
          atualizadoEm: string
          cargo: string
          criadoEm: string
          criadoPorId: string | null
          encargosPercent: number
          funcaoId: string | null
          id: string
          nome: string
          recebeProgramacao: boolean
          salarioMensal: number
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          atualizadoEm?: string
          cargo: string
          criadoEm?: string
          criadoPorId?: string | null
          encargosPercent: number
          funcaoId?: string | null
          id?: string
          nome: string
          recebeProgramacao?: boolean
          salarioMensal: number
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          atualizadoEm?: string
          cargo?: string
          criadoEm?: string
          criadoPorId?: string | null
          encargosPercent?: number
          funcaoId?: string | null
          id?: string
          nome?: string
          recebeProgramacao?: boolean
          salarioMensal?: number
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Funcionario_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Funcionario_funcaoId_fkey"
            columns: ["funcaoId"]
            isOneToOne: false
            referencedRelation: "Funcao"
            referencedColumns: ["id"]
          },
        ]
      }
      Indisponibilidade: {
        Row: {
          criadoEm: string
          criadoPorId: string | null
          dataFim: string
          dataInicio: string
          funcionarioId: string | null
          id: string
          motivo: string
          tipo: Database["public"]["Enums"]["TipoIndisponibilidade"]
          veiculoId: string | null
        }
        Insert: {
          criadoEm?: string
          criadoPorId?: string | null
          dataFim: string
          dataInicio: string
          funcionarioId?: string | null
          id?: string
          motivo: string
          tipo: Database["public"]["Enums"]["TipoIndisponibilidade"]
          veiculoId?: string | null
        }
        Update: {
          criadoEm?: string
          criadoPorId?: string | null
          dataFim?: string
          dataInicio?: string
          funcionarioId?: string | null
          id?: string
          motivo?: string
          tipo?: Database["public"]["Enums"]["TipoIndisponibilidade"]
          veiculoId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Indisponibilidade_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Indisponibilidade_funcionarioId_fkey"
            columns: ["funcionarioId"]
            isOneToOne: false
            referencedRelation: "Funcionario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Indisponibilidade_veiculoId_fkey"
            columns: ["veiculoId"]
            isOneToOne: false
            referencedRelation: "Veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      Interacao: {
        Row: {
          criadoEm: string
          data: string
          descricao: string
          id: string
          oportunidadeId: string
          responsavelId: string
          tipo: Database["public"]["Enums"]["TipoInteracao"]
        }
        Insert: {
          criadoEm?: string
          data: string
          descricao: string
          id?: string
          oportunidadeId: string
          responsavelId: string
          tipo: Database["public"]["Enums"]["TipoInteracao"]
        }
        Update: {
          criadoEm?: string
          data?: string
          descricao?: string
          id?: string
          oportunidadeId?: string
          responsavelId?: string
          tipo?: Database["public"]["Enums"]["TipoInteracao"]
        }
        Relationships: [
          {
            foreignKeyName: "Interacao_oportunidadeId_fkey"
            columns: ["oportunidadeId"]
            isOneToOne: false
            referencedRelation: "Oportunidade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Interacao_responsavelId_fkey"
            columns: ["responsavelId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      InteracaoChamado: {
        Row: {
          chamadoId: string
          criadoEm: string
          data: string
          descricao: string
          direcao: Database["public"]["Enums"]["DirecaoInteracao"]
          id: string
          protocolo: string | null
          responsavelId: string
          tipo: Database["public"]["Enums"]["TipoInteracaoChamado"]
        }
        Insert: {
          chamadoId: string
          criadoEm?: string
          data?: string
          descricao: string
          direcao?: Database["public"]["Enums"]["DirecaoInteracao"]
          id?: string
          protocolo?: string | null
          responsavelId: string
          tipo: Database["public"]["Enums"]["TipoInteracaoChamado"]
        }
        Update: {
          chamadoId?: string
          criadoEm?: string
          data?: string
          descricao?: string
          direcao?: Database["public"]["Enums"]["DirecaoInteracao"]
          id?: string
          protocolo?: string | null
          responsavelId?: string
          tipo?: Database["public"]["Enums"]["TipoInteracaoChamado"]
        }
        Relationships: [
          {
            foreignKeyName: "InteracaoChamado_chamadoId_fkey"
            columns: ["chamadoId"]
            isOneToOne: false
            referencedRelation: "Chamado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "InteracaoChamado_responsavelId_fkey"
            columns: ["responsavelId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Kit: {
        Row: {
          atualizadoEm: string
          categoria: string | null
          criadoEm: string
          criadoPorId: string | null
          id: string
          nome: string
        }
        Insert: {
          atualizadoEm?: string
          categoria?: string | null
          criadoEm?: string
          criadoPorId?: string | null
          id?: string
          nome: string
        }
        Update: {
          atualizadoEm?: string
          categoria?: string | null
          criadoEm?: string
          criadoPorId?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "Kit_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      KitItem: {
        Row: {
          id: string
          kitId: string
          materialId: string
          quantidade: number
        }
        Insert: {
          id?: string
          kitId: string
          materialId: string
          quantidade: number
        }
        Update: {
          id?: string
          kitId?: string
          materialId?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "KitItem_kitId_fkey"
            columns: ["kitId"]
            isOneToOne: false
            referencedRelation: "Kit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "KitItem_materialId_fkey"
            columns: ["materialId"]
            isOneToOne: false
            referencedRelation: "Material"
            referencedColumns: ["id"]
          },
        ]
      }
      Material: {
        Row: {
          atualizadoEm: string
          categoria: string
          codigo: string
          criadoEm: string
          criadoPorId: string | null
          custoUnitario: number
          descricao: string
          fornecedor: string | null
          id: string
          unidade: string
        }
        Insert: {
          atualizadoEm?: string
          categoria: string
          codigo: string
          criadoEm?: string
          criadoPorId?: string | null
          custoUnitario: number
          descricao: string
          fornecedor?: string | null
          id?: string
          unidade: string
        }
        Update: {
          atualizadoEm?: string
          categoria?: string
          codigo?: string
          criadoEm?: string
          criadoPorId?: string | null
          custoUnitario?: number
          descricao?: string
          fornecedor?: string | null
          id?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "Material_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Mensagem: {
        Row: {
          autorId: string
          conversaId: string
          corpo: string | null
          criadaEm: string
          id: string
          removidaEm: string | null
          removidaPorId: string | null
        }
        Insert: {
          autorId: string
          conversaId: string
          corpo?: string | null
          criadaEm?: string
          id?: string
          removidaEm?: string | null
          removidaPorId?: string | null
        }
        Update: {
          autorId?: string
          conversaId?: string
          corpo?: string | null
          criadaEm?: string
          id?: string
          removidaEm?: string | null
          removidaPorId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Mensagem_autorId_fkey"
            columns: ["autorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Mensagem_conversaId_fkey"
            columns: ["conversaId"]
            isOneToOne: false
            referencedRelation: "Conversa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Mensagem_removidaPorId_fkey"
            columns: ["removidaPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      MensagemWhatsapp: {
        Row: {
          busca: unknown
          caminhoStorage: string | null
          chamadoId: string | null
          conteudo: string | null
          conversaId: string
          criadoEm: string
          direcao: Database["public"]["Enums"]["DirecaoMensagemWhatsapp"]
          entregue: boolean
          enviadoPorId: string | null
          erroEnvio: string | null
          id: string
          mensagemExternaId: string | null
          mime: string | null
          nomeArquivo: string | null
          ocultaEm: string | null
          ocultaPorId: string | null
          payload: Json | null
          recebidoEm: string
          tamanho: number | null
          tipo: Database["public"]["Enums"]["TipoMensagemWhatsapp"]
        }
        Insert: {
          busca?: unknown
          caminhoStorage?: string | null
          chamadoId?: string | null
          conteudo?: string | null
          conversaId: string
          criadoEm?: string
          direcao: Database["public"]["Enums"]["DirecaoMensagemWhatsapp"]
          entregue?: boolean
          enviadoPorId?: string | null
          erroEnvio?: string | null
          id?: string
          mensagemExternaId?: string | null
          mime?: string | null
          nomeArquivo?: string | null
          ocultaEm?: string | null
          ocultaPorId?: string | null
          payload?: Json | null
          recebidoEm?: string
          tamanho?: number | null
          tipo?: Database["public"]["Enums"]["TipoMensagemWhatsapp"]
        }
        Update: {
          busca?: unknown
          caminhoStorage?: string | null
          chamadoId?: string | null
          conteudo?: string | null
          conversaId?: string
          criadoEm?: string
          direcao?: Database["public"]["Enums"]["DirecaoMensagemWhatsapp"]
          entregue?: boolean
          enviadoPorId?: string | null
          erroEnvio?: string | null
          id?: string
          mensagemExternaId?: string | null
          mime?: string | null
          nomeArquivo?: string | null
          ocultaEm?: string | null
          ocultaPorId?: string | null
          payload?: Json | null
          recebidoEm?: string
          tamanho?: number | null
          tipo?: Database["public"]["Enums"]["TipoMensagemWhatsapp"]
        }
        Relationships: [
          {
            foreignKeyName: "MensagemWhatsapp_chamadoId_fkey"
            columns: ["chamadoId"]
            isOneToOne: false
            referencedRelation: "Chamado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "MensagemWhatsapp_conversaId_fkey"
            columns: ["conversaId"]
            isOneToOne: false
            referencedRelation: "ConversaWhatsapp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "MensagemWhatsapp_enviadoPorId_fkey"
            columns: ["enviadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "MensagemWhatsapp_ocultaPorId_fkey"
            columns: ["ocultaPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      NotificacaoPosVenda: {
        Row: {
          chamadoId: string | null
          conversaId: string | null
          criadoEm: string
          detalhe: string | null
          geradaPorId: string | null
          id: string
          lidaEm: string | null
          referencia: string
          tipo: Database["public"]["Enums"]["TipoNotificacaoPosVenda"]
          titulo: string
          usuarioId: string
        }
        Insert: {
          chamadoId?: string | null
          conversaId?: string | null
          criadoEm?: string
          detalhe?: string | null
          geradaPorId?: string | null
          id?: string
          lidaEm?: string | null
          referencia?: string
          tipo: Database["public"]["Enums"]["TipoNotificacaoPosVenda"]
          titulo: string
          usuarioId: string
        }
        Update: {
          chamadoId?: string | null
          conversaId?: string | null
          criadoEm?: string
          detalhe?: string | null
          geradaPorId?: string | null
          id?: string
          lidaEm?: string | null
          referencia?: string
          tipo?: Database["public"]["Enums"]["TipoNotificacaoPosVenda"]
          titulo?: string
          usuarioId?: string
        }
        Relationships: [
          {
            foreignKeyName: "NotificacaoPosVenda_chamadoId_fkey"
            columns: ["chamadoId"]
            isOneToOne: false
            referencedRelation: "Chamado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "NotificacaoPosVenda_conversaId_fkey"
            columns: ["conversaId"]
            isOneToOne: false
            referencedRelation: "ConversaWhatsapp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "NotificacaoPosVenda_geradaPorId_fkey"
            columns: ["geradaPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "NotificacaoPosVenda_usuarioId_fkey"
            columns: ["usuarioId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Obra: {
        Row: {
          atualizadoEm: string
          atualizadoPorId: string | null
          avancoFisicoPercent: number
          clienteId: string | null
          criadoEm: string
          custoOrcado: number
          custoRealizado: number
          dataInicio: string | null
          dataPrevistaConclusao: string | null
          id: string
          nomeProjeto: string | null
          oportunidadeId: string | null
          origem: Database["public"]["Enums"]["OrigemObra"]
          status: Database["public"]["Enums"]["StatusObra"]
        }
        Insert: {
          atualizadoEm?: string
          atualizadoPorId?: string | null
          avancoFisicoPercent?: number
          clienteId?: string | null
          criadoEm?: string
          custoOrcado: number
          custoRealizado?: number
          dataInicio?: string | null
          dataPrevistaConclusao?: string | null
          id?: string
          nomeProjeto?: string | null
          oportunidadeId?: string | null
          origem?: Database["public"]["Enums"]["OrigemObra"]
          status?: Database["public"]["Enums"]["StatusObra"]
        }
        Update: {
          atualizadoEm?: string
          atualizadoPorId?: string | null
          avancoFisicoPercent?: number
          clienteId?: string | null
          criadoEm?: string
          custoOrcado?: number
          custoRealizado?: number
          dataInicio?: string | null
          dataPrevistaConclusao?: string | null
          id?: string
          nomeProjeto?: string | null
          oportunidadeId?: string | null
          origem?: Database["public"]["Enums"]["OrigemObra"]
          status?: Database["public"]["Enums"]["StatusObra"]
        }
        Relationships: [
          {
            foreignKeyName: "Obra_atualizadoPorId_fkey"
            columns: ["atualizadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Obra_clienteId_fkey"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "Cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Obra_oportunidadeId_fkey"
            columns: ["oportunidadeId"]
            isOneToOne: true
            referencedRelation: "Oportunidade"
            referencedColumns: ["id"]
          },
        ]
      }
      Oportunidade: {
        Row: {
          atualizadoEm: string
          clienteId: string
          criadoEm: string
          estagio: Database["public"]["Enums"]["EstagioOportunidade"]
          id: string
          motivoPerda: string | null
          orcamentoId: string
          proximaAcaoData: string | null
          responsavelId: string
          valorEstimado: number | null
        }
        Insert: {
          atualizadoEm?: string
          clienteId: string
          criadoEm?: string
          estagio?: Database["public"]["Enums"]["EstagioOportunidade"]
          id?: string
          motivoPerda?: string | null
          orcamentoId: string
          proximaAcaoData?: string | null
          responsavelId: string
          valorEstimado?: number | null
        }
        Update: {
          atualizadoEm?: string
          clienteId?: string
          criadoEm?: string
          estagio?: Database["public"]["Enums"]["EstagioOportunidade"]
          id?: string
          motivoPerda?: string | null
          orcamentoId?: string
          proximaAcaoData?: string | null
          responsavelId?: string
          valorEstimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "Oportunidade_clienteId_fkey"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "Cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Oportunidade_orcamentoId_fkey"
            columns: ["orcamentoId"]
            isOneToOne: true
            referencedRelation: "Orcamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Oportunidade_responsavelId_fkey"
            columns: ["responsavelId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Orcamento: {
        Row: {
          ajusteMaoObraPercent: number
          atualizadoEm: string
          bdiPersonalizado: number | null
          camposEspecificos: Json | null
          clienteId: string
          criadoEm: string
          criadoPorId: string
          descontoPercent: number
          descricao: string | null
          id: string
          impostosPersonalizado: number | null
          nomeProjeto: string
          status: Database["public"]["Enums"]["StatusOrcamento"]
          tipoProposta: Database["public"]["Enums"]["TipoProposta"]
        }
        Insert: {
          ajusteMaoObraPercent?: number
          atualizadoEm?: string
          bdiPersonalizado?: number | null
          camposEspecificos?: Json | null
          clienteId: string
          criadoEm?: string
          criadoPorId: string
          descontoPercent?: number
          descricao?: string | null
          id?: string
          impostosPersonalizado?: number | null
          nomeProjeto: string
          status?: Database["public"]["Enums"]["StatusOrcamento"]
          tipoProposta: Database["public"]["Enums"]["TipoProposta"]
        }
        Update: {
          ajusteMaoObraPercent?: number
          atualizadoEm?: string
          bdiPersonalizado?: number | null
          camposEspecificos?: Json | null
          clienteId?: string
          criadoEm?: string
          criadoPorId?: string
          descontoPercent?: number
          descricao?: string | null
          id?: string
          impostosPersonalizado?: number | null
          nomeProjeto?: string
          status?: Database["public"]["Enums"]["StatusOrcamento"]
          tipoProposta?: Database["public"]["Enums"]["TipoProposta"]
        }
        Relationships: [
          {
            foreignKeyName: "Orcamento_clienteId_fkey"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "Cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Orcamento_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      OrcamentoItem: {
        Row: {
          criadoEm: string
          custoUnitarioNoMomento: number
          id: string
          kitId: string | null
          materialId: string | null
          orcamentoId: string
          quantidade: number
          subtotal: number
          tipo: Database["public"]["Enums"]["TipoOrcamentoItem"]
        }
        Insert: {
          criadoEm?: string
          custoUnitarioNoMomento: number
          id?: string
          kitId?: string | null
          materialId?: string | null
          orcamentoId: string
          quantidade: number
          subtotal: number
          tipo: Database["public"]["Enums"]["TipoOrcamentoItem"]
        }
        Update: {
          criadoEm?: string
          custoUnitarioNoMomento?: number
          id?: string
          kitId?: string | null
          materialId?: string | null
          orcamentoId?: string
          quantidade?: number
          subtotal?: number
          tipo?: Database["public"]["Enums"]["TipoOrcamentoItem"]
        }
        Relationships: [
          {
            foreignKeyName: "OrcamentoItem_kitId_fkey"
            columns: ["kitId"]
            isOneToOne: false
            referencedRelation: "Kit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "OrcamentoItem_materialId_fkey"
            columns: ["materialId"]
            isOneToOne: false
            referencedRelation: "Material"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "OrcamentoItem_orcamentoId_fkey"
            columns: ["orcamentoId"]
            isOneToOne: false
            referencedRelation: "Orcamento"
            referencedColumns: ["id"]
          },
        ]
      }
      OrcamentoMaoObra: {
        Row: {
          criadoEm: string
          custoCalculado: number
          diasAlocados: number
          funcaoId: string
          id: string
          orcamentoId: string
        }
        Insert: {
          criadoEm?: string
          custoCalculado: number
          diasAlocados: number
          funcaoId: string
          id?: string
          orcamentoId: string
        }
        Update: {
          criadoEm?: string
          custoCalculado?: number
          diasAlocados?: number
          funcaoId?: string
          id?: string
          orcamentoId?: string
        }
        Relationships: [
          {
            foreignKeyName: "OrcamentoMaoObra_funcaoId_fkey"
            columns: ["funcaoId"]
            isOneToOne: false
            referencedRelation: "Funcao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "OrcamentoMaoObra_orcamentoId_fkey"
            columns: ["orcamentoId"]
            isOneToOne: false
            referencedRelation: "Orcamento"
            referencedColumns: ["id"]
          },
        ]
      }
      ParametroGeral: {
        Row: {
          atualizadoEm: string
          atualizadoPorId: string | null
          bdiPadrao: number
          diasSemanaComercial: number[]
          diasSemMovimentoChamado: number
          diasUteisMes: number
          encargosSociais: number
          horaFimComercial: string
          horaInicioComercial: string
          id: string
          impostos: number
          margemMinima: number
          tetoDiarioAvisosProgramacao: number
          tetoDiarioConversasNovas: number
          textoImpostosPadrao: string
          validadePropostaPadraoDias: number
        }
        Insert: {
          atualizadoEm?: string
          atualizadoPorId?: string | null
          bdiPadrao: number
          diasSemanaComercial?: number[]
          diasSemMovimentoChamado?: number
          diasUteisMes?: number
          encargosSociais: number
          horaFimComercial?: string
          horaInicioComercial?: string
          id?: string
          impostos: number
          margemMinima: number
          tetoDiarioAvisosProgramacao?: number
          tetoDiarioConversasNovas?: number
          textoImpostosPadrao: string
          validadePropostaPadraoDias: number
        }
        Update: {
          atualizadoEm?: string
          atualizadoPorId?: string | null
          bdiPadrao?: number
          diasSemanaComercial?: number[]
          diasSemMovimentoChamado?: number
          diasUteisMes?: number
          encargosSociais?: number
          horaFimComercial?: string
          horaInicioComercial?: string
          id?: string
          impostos?: number
          margemMinima?: number
          tetoDiarioAvisosProgramacao?: number
          tetoDiarioConversasNovas?: number
          textoImpostosPadrao?: string
          validadePropostaPadraoDias?: number
        }
        Relationships: [
          {
            foreignKeyName: "ParametroGeral_atualizadoPorId_fkey"
            columns: ["atualizadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      ParticipanteConversa: {
        Row: {
          conversaId: string
          entrouEm: string
          id: string
          ultimaLeituraEm: string | null
          usuarioId: string
        }
        Insert: {
          conversaId: string
          entrouEm?: string
          id?: string
          ultimaLeituraEm?: string | null
          usuarioId: string
        }
        Update: {
          conversaId?: string
          entrouEm?: string
          id?: string
          ultimaLeituraEm?: string | null
          usuarioId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ParticipanteConversa_conversaId_fkey"
            columns: ["conversaId"]
            isOneToOne: false
            referencedRelation: "Conversa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ParticipanteConversa_usuarioId_fkey"
            columns: ["usuarioId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      ProgramacaoDiaria: {
        Row: {
          atualizadoEm: string | null
          atualizadoPorId: string | null
          criadoEm: string
          criadoPorId: string | null
          data: string
          descricaoAvulsa: string | null
          id: string
          motoristaId: string | null
          obraId: string | null
          observacao: string | null
          publicadaEm: string | null
          servico: string
          status: Database["public"]["Enums"]["StatusProgramacao"]
          temAlteracaoPendente: boolean
          tipoDestino: Database["public"]["Enums"]["TipoDestinoProgramacao"]
          veiculoId: string | null
        }
        Insert: {
          atualizadoEm?: string | null
          atualizadoPorId?: string | null
          criadoEm?: string
          criadoPorId?: string | null
          data: string
          descricaoAvulsa?: string | null
          id?: string
          motoristaId?: string | null
          obraId?: string | null
          observacao?: string | null
          publicadaEm?: string | null
          servico: string
          status?: Database["public"]["Enums"]["StatusProgramacao"]
          temAlteracaoPendente?: boolean
          tipoDestino: Database["public"]["Enums"]["TipoDestinoProgramacao"]
          veiculoId?: string | null
        }
        Update: {
          atualizadoEm?: string | null
          atualizadoPorId?: string | null
          criadoEm?: string
          criadoPorId?: string | null
          data?: string
          descricaoAvulsa?: string | null
          id?: string
          motoristaId?: string | null
          obraId?: string | null
          observacao?: string | null
          publicadaEm?: string | null
          servico?: string
          status?: Database["public"]["Enums"]["StatusProgramacao"]
          temAlteracaoPendente?: boolean
          tipoDestino?: Database["public"]["Enums"]["TipoDestinoProgramacao"]
          veiculoId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ProgramacaoDiaria_atualizadoPorId_fkey"
            columns: ["atualizadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ProgramacaoDiaria_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ProgramacaoDiaria_motoristaId_fkey"
            columns: ["motoristaId"]
            isOneToOne: false
            referencedRelation: "Funcionario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ProgramacaoDiaria_obraId_fkey"
            columns: ["obraId"]
            isOneToOne: false
            referencedRelation: "Obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ProgramacaoDiaria_veiculoId_fkey"
            columns: ["veiculoId"]
            isOneToOne: false
            referencedRelation: "Veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      ProgramacaoEquipe: {
        Row: {
          funcionarioId: string
          id: string
          programacaoId: string
        }
        Insert: {
          funcionarioId: string
          id?: string
          programacaoId: string
        }
        Update: {
          funcionarioId?: string
          id?: string
          programacaoId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ProgramacaoEquipe_funcionarioId_fkey"
            columns: ["funcionarioId"]
            isOneToOne: false
            referencedRelation: "Funcionario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ProgramacaoEquipe_programacaoId_fkey"
            columns: ["programacaoId"]
            isOneToOne: false
            referencedRelation: "ProgramacaoDiaria"
            referencedColumns: ["id"]
          },
        ]
      }
      ProgramacaoResponsavel: {
        Row: {
          id: string
          programacaoId: string
          usuarioId: string
        }
        Insert: {
          id?: string
          programacaoId: string
          usuarioId: string
        }
        Update: {
          id?: string
          programacaoId?: string
          usuarioId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ProgramacaoResponsavel_programacaoId_fkey"
            columns: ["programacaoId"]
            isOneToOne: false
            referencedRelation: "ProgramacaoDiaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ProgramacaoResponsavel_usuarioId_fkey"
            columns: ["usuarioId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Proposta: {
        Row: {
          ano: number
          arquivoUrl: string
          geradoEm: string
          geradoPorId: string
          id: string
          modeloUsado: Database["public"]["Enums"]["TipoProposta"]
          numero: number
          orcamentoId: string
          revisao: number
          valorFinal: number
          versao: number
        }
        Insert: {
          ano: number
          arquivoUrl: string
          geradoEm?: string
          geradoPorId: string
          id?: string
          modeloUsado: Database["public"]["Enums"]["TipoProposta"]
          numero: number
          orcamentoId: string
          revisao?: number
          valorFinal: number
          versao?: number
        }
        Update: {
          ano?: number
          arquivoUrl?: string
          geradoEm?: string
          geradoPorId?: string
          id?: string
          modeloUsado?: Database["public"]["Enums"]["TipoProposta"]
          numero?: number
          orcamentoId?: string
          revisao?: number
          valorFinal?: number
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "Proposta_geradoPorId_fkey"
            columns: ["geradoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Proposta_orcamentoId_fkey"
            columns: ["orcamentoId"]
            isOneToOne: false
            referencedRelation: "Orcamento"
            referencedColumns: ["id"]
          },
        ]
      }
      PropostaDadosComplementares: {
        Row: {
          atualizadoEm: string
          cidadeExecucao: string
          condicoesPagamento: string
          contatoDestinatarioId: string | null
          escopoTecnico: string
          id: string
          objetoResumo: string
          observacoesFinais: string | null
          orcamentoId: string
          prazoExecucaoDias: number
          textoImpostos: string
          ufExecucao: string
          validadePropostaDias: number
        }
        Insert: {
          atualizadoEm?: string
          cidadeExecucao: string
          condicoesPagamento: string
          contatoDestinatarioId?: string | null
          escopoTecnico: string
          id?: string
          objetoResumo: string
          observacoesFinais?: string | null
          orcamentoId: string
          prazoExecucaoDias: number
          textoImpostos: string
          ufExecucao: string
          validadePropostaDias: number
        }
        Update: {
          atualizadoEm?: string
          cidadeExecucao?: string
          condicoesPagamento?: string
          contatoDestinatarioId?: string | null
          escopoTecnico?: string
          id?: string
          objetoResumo?: string
          observacoesFinais?: string | null
          orcamentoId?: string
          prazoExecucaoDias?: number
          textoImpostos?: string
          ufExecucao?: string
          validadePropostaDias?: number
        }
        Relationships: [
          {
            foreignKeyName: "PropostaDadosComplementares_contatoDestinatarioId_fkey"
            columns: ["contatoDestinatarioId"]
            isOneToOne: false
            referencedRelation: "ContatoCliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PropostaDadosComplementares_orcamentoId_fkey"
            columns: ["orcamentoId"]
            isOneToOne: true
            referencedRelation: "Orcamento"
            referencedColumns: ["id"]
          },
        ]
      }
      PropostaDadosSolar: {
        Row: {
          areaInstalacaoM2: number
          arvoresEquivalentesAno: number
          atualizadoEm: string
          certificacoes: string
          co2EvitadoToneladasAno: number
          consumoMedioMensalKwh: number
          contaAtualSemSolar: number
          contaEstimadaComSolar: number
          economiaAnualPrevista: number
          equipamentos: Json
          garantiaEstruturasAnos: number
          garantiaInversoresAnos: number
          garantiaModulosAnos: number
          geracaoMensalEstimada: Json
          id: string
          inflacaoEnergeticaPercent: number
          orcamentoId: string
          paybackEstimado: string
          perdaEficienciaAnos: number
          perdaEficienciaPercent: number
          valorKwhVigente: number
          vidaUtilAnos: number
        }
        Insert: {
          areaInstalacaoM2: number
          arvoresEquivalentesAno: number
          atualizadoEm?: string
          certificacoes: string
          co2EvitadoToneladasAno: number
          consumoMedioMensalKwh: number
          contaAtualSemSolar: number
          contaEstimadaComSolar: number
          economiaAnualPrevista: number
          equipamentos: Json
          garantiaEstruturasAnos: number
          garantiaInversoresAnos: number
          garantiaModulosAnos: number
          geracaoMensalEstimada: Json
          id?: string
          inflacaoEnergeticaPercent: number
          orcamentoId: string
          paybackEstimado: string
          perdaEficienciaAnos: number
          perdaEficienciaPercent: number
          valorKwhVigente: number
          vidaUtilAnos: number
        }
        Update: {
          areaInstalacaoM2?: number
          arvoresEquivalentesAno?: number
          atualizadoEm?: string
          certificacoes?: string
          co2EvitadoToneladasAno?: number
          consumoMedioMensalKwh?: number
          contaAtualSemSolar?: number
          contaEstimadaComSolar?: number
          economiaAnualPrevista?: number
          equipamentos?: Json
          garantiaEstruturasAnos?: number
          garantiaInversoresAnos?: number
          garantiaModulosAnos?: number
          geracaoMensalEstimada?: Json
          id?: string
          inflacaoEnergeticaPercent?: number
          orcamentoId?: string
          paybackEstimado?: string
          perdaEficienciaAnos?: number
          perdaEficienciaPercent?: number
          valorKwhVigente?: number
          vidaUtilAnos?: number
        }
        Relationships: [
          {
            foreignKeyName: "PropostaDadosSolar_orcamentoId_fkey"
            columns: ["orcamentoId"]
            isOneToOne: true
            referencedRelation: "Orcamento"
            referencedColumns: ["id"]
          },
        ]
      }
      TipoProblemaPosVenda: {
        Row: {
          ativo: boolean
          criadoEm: string
          dependeConcessionaria: boolean
          descricao: string | null
          diasAlerta: number
          id: string
          nome: string
          ordem: number
          prazoDias: number
        }
        Insert: {
          ativo?: boolean
          criadoEm?: string
          dependeConcessionaria?: boolean
          descricao?: string | null
          diasAlerta?: number
          id?: string
          nome: string
          ordem?: number
          prazoDias?: number
        }
        Update: {
          ativo?: boolean
          criadoEm?: string
          dependeConcessionaria?: boolean
          descricao?: string | null
          diasAlerta?: number
          id?: string
          nome?: string
          ordem?: number
          prazoDias?: number
        }
        Relationships: []
      }
      UnidadeConsumidora: {
        Row: {
          apelido: string | null
          ativo: boolean
          atualizadoEm: string
          cidade: string | null
          clienteId: string
          concessionariaId: string | null
          criadoEm: string
          endereco: string | null
          geradoraId: string | null
          id: string
          numero: string
          obraId: string | null
          percentualRateio: number | null
          potenciaKwp: number | null
          tipo: Database["public"]["Enums"]["TipoUnidadeConsumidora"]
          titular: string | null
          uf: string | null
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          atualizadoEm?: string
          cidade?: string | null
          clienteId: string
          concessionariaId?: string | null
          criadoEm?: string
          endereco?: string | null
          geradoraId?: string | null
          id?: string
          numero: string
          obraId?: string | null
          percentualRateio?: number | null
          potenciaKwp?: number | null
          tipo?: Database["public"]["Enums"]["TipoUnidadeConsumidora"]
          titular?: string | null
          uf?: string | null
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          atualizadoEm?: string
          cidade?: string | null
          clienteId?: string
          concessionariaId?: string | null
          criadoEm?: string
          endereco?: string | null
          geradoraId?: string | null
          id?: string
          numero?: string
          obraId?: string | null
          percentualRateio?: number | null
          potenciaKwp?: number | null
          tipo?: Database["public"]["Enums"]["TipoUnidadeConsumidora"]
          titular?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "UnidadeConsumidora_clienteId_fkey"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "Cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "UnidadeConsumidora_concessionariaId_fkey"
            columns: ["concessionariaId"]
            isOneToOne: false
            referencedRelation: "Concessionaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "UnidadeConsumidora_geradoraId_fkey"
            columns: ["geradoraId"]
            isOneToOne: false
            referencedRelation: "UnidadeConsumidora"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "UnidadeConsumidora_obraId_fkey"
            columns: ["obraId"]
            isOneToOne: false
            referencedRelation: "Obra"
            referencedColumns: ["id"]
          },
        ]
      }
      Usuario: {
        Row: {
          ativo: boolean
          criadoEm: string
          email: string
          id: string
          nome: string
          notificaPosVenda: boolean
          notificaWhatsappSemDono: boolean
          perfil: Database["public"]["Enums"]["PerfilUsuario"]
          recebeProgramacao: boolean
          senhaHash: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          criadoEm?: string
          email: string
          id?: string
          nome: string
          notificaPosVenda?: boolean
          notificaWhatsappSemDono?: boolean
          perfil: Database["public"]["Enums"]["PerfilUsuario"]
          recebeProgramacao?: boolean
          senhaHash: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          criadoEm?: string
          email?: string
          id?: string
          nome?: string
          notificaPosVenda?: boolean
          notificaWhatsappSemDono?: boolean
          perfil?: Database["public"]["Enums"]["PerfilUsuario"]
          recebeProgramacao?: boolean
          senhaHash?: string
          telefone?: string | null
        }
        Relationships: []
      }
      Veiculo: {
        Row: {
          ativo: boolean
          criadoEm: string
          criadoPorId: string | null
          id: string
          identificacao: string | null
          modelo: string
          placa: string
          tipo: Database["public"]["Enums"]["TipoVeiculo"]
        }
        Insert: {
          ativo?: boolean
          criadoEm?: string
          criadoPorId?: string | null
          id?: string
          identificacao?: string | null
          modelo: string
          placa: string
          tipo: Database["public"]["Enums"]["TipoVeiculo"]
        }
        Update: {
          ativo?: boolean
          criadoEm?: string
          criadoPorId?: string | null
          id?: string
          identificacao?: string | null
          modelo?: string
          placa?: string
          tipo?: Database["public"]["Enums"]["TipoVeiculo"]
        }
        Relationships: [
          {
            foreignKeyName: "Veiculo_criadoPorId_fkey"
            columns: ["criadoPorId"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      conversas_do_usuario: {
        Args: { p_usuario_id: string }
        Returns: {
          id: string
          naoLidas: number
          obraId: string
          tipo: Database["public"]["Enums"]["TipoConversa"]
          titulo: string
          ultimaMensagemCorpo: string
          ultimaMensagemEm: string
        }[]
      }
      excluir_cliente_cascata: {
        Args: { p_cliente_id: string }
        Returns: undefined
      }
    }
    Enums: {
      DirecaoInteracao: "cliente" | "concessionaria" | "interno"
      DirecaoMensagemWhatsapp: "entrada" | "saida"
      EstagioChamado:
        | "aberto"
        | "em_analise"
        | "aguardando_concessionaria"
        | "concluido"
      EstagioOportunidade:
        | "lead"
        | "levantamento_escopo"
        | "orcamento_elaboracao"
        | "proposta_enviada"
        | "negociacao"
        | "aprovada"
        | "perdida"
      OrigemObra: "funil" | "manual"
      PapelDestinatario:
        | "responsavel"
        | "motorista_novo"
        | "motorista_removido"
      PerfilUsuario:
        | "comercial"
        | "engenharia"
        | "obra"
        | "admin"
        | "atendimento"
        | "logistica"
      PrioridadeChamado: "baixa" | "media" | "alta" | "critica"
      RamoCliente: "energia_solar" | "redes_subestacoes"
      StatusObra: "em_andamento" | "concluida" | "atrasada"
      StatusOrcamento: "em_elaboracao" | "finalizado" | "revisao"
      StatusProgramacao: "rascunho" | "publicada" | "cancelada"
      TipoConversa: "obra" | "direta" | "grupo"
      TipoDestinoProgramacao: "obra" | "avulso"
      TipoIndisponibilidade: "funcionario" | "veiculo"
      TipoInteracao: "ligacao" | "email" | "reuniao" | "visita"
      TipoInteracaoChamado:
        | "ligacao"
        | "email"
        | "whatsapp"
        | "reuniao"
        | "visita"
        | "agencia_cosern"
        | "protocolo"
        | "nota_interna"
      TipoMensagemWhatsapp: "texto" | "imagem" | "documento" | "audio"
      TipoNotificacaoPosVenda:
        | "chamado_novo"
        | "chamado_vencido"
        | "chamado_atualizado"
        | "interacao_registrada"
        | "conversa_sem_dono"
        | "conversa_atribuida"
        | "chamado_direcionado"
        | "responsavel_alterado"
        | "chamado_sem_movimento"
      TipoOrcamentoItem: "material" | "kit"
      TipoProposta: "usina_solar" | "redes"
      TipoUnidadeConsumidora: "geradora" | "beneficiaria"
      TipoVeiculo:
        | "caminhonete"
        | "van"
        | "munck"
        | "caminhao"
        | "carro_passeio"
        | "outro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      DirecaoInteracao: ["cliente", "concessionaria", "interno"],
      DirecaoMensagemWhatsapp: ["entrada", "saida"],
      EstagioChamado: [
        "aberto",
        "em_analise",
        "aguardando_concessionaria",
        "concluido",
      ],
      EstagioOportunidade: [
        "lead",
        "levantamento_escopo",
        "orcamento_elaboracao",
        "proposta_enviada",
        "negociacao",
        "aprovada",
        "perdida",
      ],
      OrigemObra: ["funil", "manual"],
      PapelDestinatario: [
        "responsavel",
        "motorista_novo",
        "motorista_removido",
      ],
      PerfilUsuario: [
        "comercial",
        "engenharia",
        "obra",
        "admin",
        "atendimento",
        "logistica",
      ],
      PrioridadeChamado: ["baixa", "media", "alta", "critica"],
      RamoCliente: ["energia_solar", "redes_subestacoes"],
      StatusObra: ["em_andamento", "concluida", "atrasada"],
      StatusOrcamento: ["em_elaboracao", "finalizado", "revisao"],
      StatusProgramacao: ["rascunho", "publicada", "cancelada"],
      TipoConversa: ["obra", "direta", "grupo"],
      TipoDestinoProgramacao: ["obra", "avulso"],
      TipoIndisponibilidade: ["funcionario", "veiculo"],
      TipoInteracao: ["ligacao", "email", "reuniao", "visita"],
      TipoInteracaoChamado: [
        "ligacao",
        "email",
        "whatsapp",
        "reuniao",
        "visita",
        "agencia_cosern",
        "protocolo",
        "nota_interna",
      ],
      TipoMensagemWhatsapp: ["texto", "imagem", "documento", "audio"],
      TipoNotificacaoPosVenda: [
        "chamado_novo",
        "chamado_vencido",
        "chamado_atualizado",
        "interacao_registrada",
        "conversa_sem_dono",
        "conversa_atribuida",
        "chamado_direcionado",
        "responsavel_alterado",
        "chamado_sem_movimento",
      ],
      TipoOrcamentoItem: ["material", "kit"],
      TipoProposta: ["usina_solar", "redes"],
      TipoUnidadeConsumidora: ["geradora", "beneficiaria"],
      TipoVeiculo: [
        "caminhonete",
        "van",
        "munck",
        "caminhao",
        "carro_passeio",
        "outro",
      ],
    },
  },
} as const
