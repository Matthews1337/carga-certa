export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _diag: {
        Row: {
          ordem: number
          resultado: string | null
          teste: string | null
        }
        Insert: {
          ordem?: number
          resultado?: string | null
          teste?: string | null
        }
        Update: {
          ordem?: number
          resultado?: string | null
          teste?: string | null
        }
        Relationships: []
      }
      abastecimento: {
        Row: {
          combustivel: Database["public"]["Enums"]["tipo_combustivel"]
          created_at: string
          deleted_at: string | null
          despesa_id: string
          estabelecimento_id: string | null
          id: string
          litros: number
          odometro: number
          piloto_id: string
          preco_litro: number
          tanque_cheio: boolean
          updated_at: string
        }
        Insert: {
          combustivel?: Database["public"]["Enums"]["tipo_combustivel"]
          created_at?: string
          deleted_at?: string | null
          despesa_id: string
          estabelecimento_id?: string | null
          id?: string
          litros: number
          odometro: number
          piloto_id?: string
          preco_litro: number
          tanque_cheio?: boolean
          updated_at?: string
        }
        Update: {
          combustivel?: Database["public"]["Enums"]["tipo_combustivel"]
          created_at?: string
          deleted_at?: string | null
          despesa_id?: string
          estabelecimento_id?: string | null
          id?: string
          litros?: number
          odometro?: number
          piloto_id?: string
          preco_litro?: number
          tanque_cheio?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abastecimento_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimento_estabelecimento_id_fkey"
            columns: ["estabelecimento_id"]
            isOneToOne: false
            referencedRelation: "estabelecimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimento_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
        ]
      }
      carga: {
        Row: {
          created_at: string
          deleted_at: string | null
          descricao: string | null
          frete_id: string
          id: string
          peso_kg: number | null
          piloto_id: string
          tipo_carga_id: string | null
          updated_at: string
          valor_mercadoria: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          frete_id: string
          id?: string
          peso_kg?: number | null
          piloto_id?: string
          tipo_carga_id?: string | null
          updated_at?: string
          valor_mercadoria?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          frete_id?: string
          id?: string
          peso_kg?: number | null
          piloto_id?: string
          tipo_carga_id?: string | null
          updated_at?: string
          valor_mercadoria?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "carga_frete_id_fkey"
            columns: ["frete_id"]
            isOneToOne: false
            referencedRelation: "frete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_tipo_carga_id_fkey"
            columns: ["tipo_carga_id"]
            isOneToOne: false
            referencedRelation: "tipo_carga"
            referencedColumns: ["id"]
          },
        ]
      }
      categoria_despesa: {
        Row: {
          ativo: boolean
          categoria_pai_id: string | null
          created_at: string
          dedutivel: boolean
          deleted_at: string | null
          escopo: Database["public"]["Enums"]["escopo_categoria"]
          icone: string | null
          id: string
          is_padrao: boolean
          nome: string
          ordem: number
          piloto_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_pai_id?: string | null
          created_at?: string
          dedutivel?: boolean
          deleted_at?: string | null
          escopo: Database["public"]["Enums"]["escopo_categoria"]
          icone?: string | null
          id?: string
          is_padrao?: boolean
          nome: string
          ordem?: number
          piloto_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_pai_id?: string | null
          created_at?: string
          dedutivel?: boolean
          deleted_at?: string | null
          escopo?: Database["public"]["Enums"]["escopo_categoria"]
          icone?: string | null
          id?: string
          is_padrao?: boolean
          nome?: string
          ordem?: number
          piloto_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categoria_despesa_categoria_pai_id_fkey"
            columns: ["categoria_pai_id"]
            isOneToOne: false
            referencedRelation: "categoria_despesa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categoria_despesa_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
        ]
      }
      cidade: {
        Row: {
          codigo_ibge: number
          created_at: string
          deleted_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          uf: string
          updated_at: string
        }
        Insert: {
          codigo_ibge: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          uf: string
          updated_at?: string
        }
        Update: {
          codigo_ibge?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      cnh: {
        Row: {
          arquivo_path: string | null
          categoria: string
          created_at: string
          deleted_at: string | null
          ear: boolean
          id: string
          numero: string
          piloto_id: string
          updated_at: string
          validade: string
        }
        Insert: {
          arquivo_path?: string | null
          categoria: string
          created_at?: string
          deleted_at?: string | null
          ear?: boolean
          id?: string
          numero: string
          piloto_id?: string
          updated_at?: string
          validade: string
        }
        Update: {
          arquivo_path?: string | null
          categoria?: string
          created_at?: string
          deleted_at?: string | null
          ear?: boolean
          id?: string
          numero?: string
          piloto_id?: string
          updated_at?: string
          validade?: string
        }
        Relationships: [
          {
            foreignKeyName: "cnh_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
        ]
      }
      condicao_trajeto: {
        Row: {
          ativo: boolean
          condicao: string
          created_at: string
          deleted_at: string | null
          descricao: string | null
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          condicao: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          condicao?: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      contratante: {
        Row: {
          cnpj: string | null
          contato: string | null
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          piloto_id: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          piloto_id?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          piloto_id?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratante_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
        ]
      }
      despesa: {
        Row: {
          categoria_id: string
          comprovante_path: string | null
          created_at: string
          data_hora: string
          deleted_at: string | null
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          latitude: number | null
          longitude: number | null
          piloto_id: string
          status: Database["public"]["Enums"]["status_despesa"]
          updated_at: string
          valor: number
          veiculo_id: string | null
          viagem_id: string | null
        }
        Insert: {
          categoria_id: string
          comprovante_path?: string | null
          created_at?: string
          data_hora?: string
          deleted_at?: string | null
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          latitude?: number | null
          longitude?: number | null
          piloto_id?: string
          status?: Database["public"]["Enums"]["status_despesa"]
          updated_at?: string
          valor: number
          veiculo_id?: string | null
          viagem_id?: string | null
        }
        Update: {
          categoria_id?: string
          comprovante_path?: string | null
          created_at?: string
          data_hora?: string
          deleted_at?: string | null
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          latitude?: number | null
          longitude?: number | null
          piloto_id?: string
          status?: Database["public"]["Enums"]["status_despesa"]
          updated_at?: string
          valor?: number
          veiculo_id?: string | null
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "despesa_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria_despesa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesa_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesa_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesa_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesa_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "vw_resultado_viagem"
            referencedColumns: ["viagem_id"]
          },
        ]
      }
      documento_veiculo: {
        Row: {
          arquivo_path: string | null
          created_at: string
          deleted_at: string | null
          emissao: string | null
          id: string
          numero: string | null
          piloto_id: string
          tipo_documento_id: string
          updated_at: string
          validade: string | null
          veiculo_id: string
        }
        Insert: {
          arquivo_path?: string | null
          created_at?: string
          deleted_at?: string | null
          emissao?: string | null
          id?: string
          numero?: string | null
          piloto_id?: string
          tipo_documento_id: string
          updated_at?: string
          validade?: string | null
          veiculo_id: string
        }
        Update: {
          arquivo_path?: string | null
          created_at?: string
          deleted_at?: string | null
          emissao?: string | null
          id?: string
          numero?: string | null
          piloto_id?: string
          tipo_documento_id?: string
          updated_at?: string
          validade?: string | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_veiculo_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_veiculo_tipo_documento_id_fkey"
            columns: ["tipo_documento_id"]
            isOneToOne: false
            referencedRelation: "tipo_documento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_veiculo_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      estabelecimento: {
        Row: {
          cidade_id: string | null
          cnpj: string | null
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          tipo: Database["public"]["Enums"]["tipo_estabelecimento"]
          updated_at: string
        }
        Insert: {
          cidade_id?: string | null
          cnpj?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          tipo?: Database["public"]["Enums"]["tipo_estabelecimento"]
          updated_at?: string
        }
        Update: {
          cidade_id?: string | null
          cnpj?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          tipo?: Database["public"]["Enums"]["tipo_estabelecimento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estabelecimento_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidade"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamento_viagem: {
        Row: {
          calculado_em: string
          consumo_medio: number | null
          created_at: string
          custo_por_km: number | null
          deleted_at: string | null
          despesa_total: number
          id: string
          km_total: number | null
          lucro_liquido: number
          piloto_id: string
          receita_total: number
          updated_at: string
          viagem_id: string
        }
        Insert: {
          calculado_em?: string
          consumo_medio?: number | null
          created_at?: string
          custo_por_km?: number | null
          deleted_at?: string | null
          despesa_total?: number
          id?: string
          km_total?: number | null
          lucro_liquido?: number
          piloto_id?: string
          receita_total?: number
          updated_at?: string
          viagem_id: string
        }
        Update: {
          calculado_em?: string
          consumo_medio?: number | null
          created_at?: string
          custo_por_km?: number | null
          deleted_at?: string | null
          despesa_total?: number
          id?: string
          km_total?: number | null
          lucro_liquido?: number
          piloto_id?: string
          receita_total?: number
          updated_at?: string
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_viagem_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_viagem_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_viagem_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "vw_resultado_viagem"
            referencedColumns: ["viagem_id"]
          },
        ]
      }
      frete: {
        Row: {
          codigo: string | null
          contratante_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          observacao: string | null
          pedagio_por_conta: Database["public"]["Enums"]["responsavel_pedagio"]
          piloto_id: string
          status: Database["public"]["Enums"]["status_frete"]
          updated_at: string
          valor_tonelada: number | null
          valor_total: number
        }
        Insert: {
          codigo?: string | null
          contratante_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          observacao?: string | null
          pedagio_por_conta?: Database["public"]["Enums"]["responsavel_pedagio"]
          piloto_id?: string
          status?: Database["public"]["Enums"]["status_frete"]
          updated_at?: string
          valor_tonelada?: number | null
          valor_total?: number
        }
        Update: {
          codigo?: string | null
          contratante_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          observacao?: string | null
          pedagio_por_conta?: Database["public"]["Enums"]["responsavel_pedagio"]
          piloto_id?: string
          status?: Database["public"]["Enums"]["status_frete"]
          updated_at?: string
          valor_tonelada?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "frete_contratante_id_fkey"
            columns: ["contratante_id"]
            isOneToOne: false
            referencedRelation: "contratante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frete_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
        ]
      }
      manutencao: {
        Row: {
          created_at: string
          deleted_at: string | null
          despesa_id: string | null
          id: string
          item: string
          observacao: string | null
          odometro: number | null
          oficina_id: string | null
          piloto_id: string
          proxima_data: string | null
          proxima_odometro: number | null
          tipo: Database["public"]["Enums"]["tipo_manutencao"]
          updated_at: string
          veiculo_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          despesa_id?: string | null
          id?: string
          item: string
          observacao?: string | null
          odometro?: number | null
          oficina_id?: string | null
          piloto_id?: string
          proxima_data?: string | null
          proxima_odometro?: number | null
          tipo?: Database["public"]["Enums"]["tipo_manutencao"]
          updated_at?: string
          veiculo_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          despesa_id?: string | null
          id?: string
          item?: string
          observacao?: string | null
          odometro?: number | null
          oficina_id?: string | null
          piloto_id?: string
          proxima_data?: string | null
          proxima_odometro?: number | null
          tipo?: Database["public"]["Enums"]["tipo_manutencao"]
          updated_at?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manutencao_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencao_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "estabelecimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencao_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencao_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      parada: {
        Row: {
          chegada_em: string | null
          cidade_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          observacao: string | null
          odometro: number | null
          ordem: number
          piloto_id: string
          saida_em: string | null
          tipo: Database["public"]["Enums"]["tipo_parada"]
          updated_at: string
          viagem_id: string
        }
        Insert: {
          chegada_em?: string | null
          cidade_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          observacao?: string | null
          odometro?: number | null
          ordem: number
          piloto_id?: string
          saida_em?: string | null
          tipo?: Database["public"]["Enums"]["tipo_parada"]
          updated_at?: string
          viagem_id: string
        }
        Update: {
          chegada_em?: string | null
          cidade_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          observacao?: string | null
          odometro?: number | null
          ordem?: number
          piloto_id?: string
          saida_em?: string | null
          tipo?: Database["public"]["Enums"]["tipo_parada"]
          updated_at?: string
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parada_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parada_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parada_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parada_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "vw_resultado_viagem"
            referencedColumns: ["viagem_id"]
          },
        ]
      }
      piloto: {
        Row: {
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          foto_path: string | null
          id: string
          nome: string
          sexo: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          foto_path?: string | null
          id: string
          nome?: string
          sexo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          foto_path?: string | null
          id?: string
          nome?: string
          sexo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receita: {
        Row: {
          created_at: string
          deleted_at: string | null
          forma_recebimento: Database["public"]["Enums"]["forma_pagamento"]
          frete_id: string
          id: string
          observacao: string | null
          piloto_id: string
          recebido_em: string | null
          tipo: Database["public"]["Enums"]["tipo_receita"]
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          forma_recebimento?: Database["public"]["Enums"]["forma_pagamento"]
          frete_id: string
          id?: string
          observacao?: string | null
          piloto_id?: string
          recebido_em?: string | null
          tipo?: Database["public"]["Enums"]["tipo_receita"]
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          forma_recebimento?: Database["public"]["Enums"]["forma_pagamento"]
          frete_id?: string
          id?: string
          observacao?: string | null
          piloto_id?: string
          recebido_em?: string | null
          tipo?: Database["public"]["Enums"]["tipo_receita"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receita_frete_id_fkey"
            columns: ["frete_id"]
            isOneToOne: false
            referencedRelation: "frete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receita_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_carga: {
        Row: {
          ativo: boolean
          created_at: string
          deleted_at: string | null
          descricao: string | null
          id: string
          nome: string
          perigosa: boolean
          refrigerada: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          perigosa?: boolean
          refrigerada?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          perigosa?: boolean
          refrigerada?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tipo_documento: {
        Row: {
          aplica_se_a: Database["public"]["Enums"]["aplica_documento"]
          ativo: boolean
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          obrigatorio: boolean
          periodicidade_meses: number | null
          updated_at: string
        }
        Insert: {
          aplica_se_a: Database["public"]["Enums"]["aplica_documento"]
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          obrigatorio?: boolean
          periodicidade_meses?: number | null
          updated_at?: string
        }
        Update: {
          aplica_se_a?: Database["public"]["Enums"]["aplica_documento"]
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          obrigatorio?: boolean
          periodicidade_meses?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      tipo_veiculo: {
        Row: {
          ativo: boolean
          capacidade_kg_ref: number | null
          categoria_cnh_minima: string | null
          created_at: string
          deleted_at: string | null
          id: string
          natureza: Database["public"]["Enums"]["natureza_veiculo"]
          nome: string
          ordem: number
          qtd_eixos: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          capacidade_kg_ref?: number | null
          categoria_cnh_minima?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          natureza: Database["public"]["Enums"]["natureza_veiculo"]
          nome: string
          ordem?: number
          qtd_eixos?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          capacidade_kg_ref?: number | null
          categoria_cnh_minima?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          natureza?: Database["public"]["Enums"]["natureza_veiculo"]
          nome?: string
          ordem?: number
          qtd_eixos?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      veiculo: {
        Row: {
          ano: number | null
          ativo: boolean
          capacidade_kg: number | null
          carroceria: Database["public"]["Enums"]["carroceria_veiculo"]
          cor: string | null
          created_at: string
          deleted_at: string | null
          id: string
          marca: string | null
          modelo: string | null
          natureza: Database["public"]["Enums"]["natureza_veiculo"]
          odometro_atual: number
          piloto_id: string
          placa: string
          qtd_eixos: number | null
          renavam: string | null
          tipo_veiculo_id: string
          updated_at: string
        }
        Insert: {
          ano?: number | null
          ativo?: boolean
          capacidade_kg?: number | null
          carroceria?: Database["public"]["Enums"]["carroceria_veiculo"]
          cor?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          natureza: Database["public"]["Enums"]["natureza_veiculo"]
          odometro_atual?: number
          piloto_id?: string
          placa: string
          qtd_eixos?: number | null
          renavam?: string | null
          tipo_veiculo_id: string
          updated_at?: string
        }
        Update: {
          ano?: number | null
          ativo?: boolean
          capacidade_kg?: number | null
          carroceria?: Database["public"]["Enums"]["carroceria_veiculo"]
          cor?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          natureza?: Database["public"]["Enums"]["natureza_veiculo"]
          odometro_atual?: number
          piloto_id?: string
          placa?: string
          qtd_eixos?: number | null
          renavam?: string | null
          tipo_veiculo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_veiculo_tipo"
            columns: ["tipo_veiculo_id", "natureza"]
            isOneToOne: false
            referencedRelation: "tipo_veiculo"
            referencedColumns: ["id", "natureza"]
          },
          {
            foreignKeyName: "veiculo_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
        ]
      }
      viagem: {
        Row: {
          cidade_destino_id: string | null
          cidade_origem_id: string | null
          condicao_trajeto_id: string | null
          created_at: string
          deleted_at: string | null
          fim_em: string | null
          frete_id: string | null
          id: string
          inicio_em: string | null
          km_total: number | null
          natureza_reboque:
            | Database["public"]["Enums"]["natureza_veiculo"]
            | null
          natureza_tracao: Database["public"]["Enums"]["natureza_veiculo"]
          observacao: string | null
          odometro_final: number | null
          odometro_inicial: number | null
          piloto_id: string
          status: Database["public"]["Enums"]["status_viagem"]
          updated_at: string
          veiculo_reboque_id: string | null
          veiculo_tracao_id: string
        }
        Insert: {
          cidade_destino_id?: string | null
          cidade_origem_id?: string | null
          condicao_trajeto_id?: string | null
          created_at?: string
          deleted_at?: string | null
          fim_em?: string | null
          frete_id?: string | null
          id?: string
          inicio_em?: string | null
          km_total?: number | null
          natureza_reboque?:
            | Database["public"]["Enums"]["natureza_veiculo"]
            | null
          natureza_tracao?: Database["public"]["Enums"]["natureza_veiculo"]
          observacao?: string | null
          odometro_final?: number | null
          odometro_inicial?: number | null
          piloto_id?: string
          status?: Database["public"]["Enums"]["status_viagem"]
          updated_at?: string
          veiculo_reboque_id?: string | null
          veiculo_tracao_id: string
        }
        Update: {
          cidade_destino_id?: string | null
          cidade_origem_id?: string | null
          condicao_trajeto_id?: string | null
          created_at?: string
          deleted_at?: string | null
          fim_em?: string | null
          frete_id?: string | null
          id?: string
          inicio_em?: string | null
          km_total?: number | null
          natureza_reboque?:
            | Database["public"]["Enums"]["natureza_veiculo"]
            | null
          natureza_tracao?: Database["public"]["Enums"]["natureza_veiculo"]
          observacao?: string | null
          odometro_final?: number | null
          odometro_inicial?: number | null
          piloto_id?: string
          status?: Database["public"]["Enums"]["status_viagem"]
          updated_at?: string
          veiculo_reboque_id?: string | null
          veiculo_tracao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_viagem_reboque"
            columns: ["veiculo_reboque_id", "natureza_reboque"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id", "natureza"]
          },
          {
            foreignKeyName: "fk_viagem_tracao"
            columns: ["veiculo_tracao_id", "natureza_tracao"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id", "natureza"]
          },
          {
            foreignKeyName: "viagem_cidade_destino_id_fkey"
            columns: ["cidade_destino_id"]
            isOneToOne: false
            referencedRelation: "cidade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagem_cidade_origem_id_fkey"
            columns: ["cidade_origem_id"]
            isOneToOne: false
            referencedRelation: "cidade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagem_condicao_trajeto_id_fkey"
            columns: ["condicao_trajeto_id"]
            isOneToOne: false
            referencedRelation: "condicao_trajeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagem_frete_id_fkey"
            columns: ["frete_id"]
            isOneToOne: false
            referencedRelation: "frete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagem_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_resultado_viagem: {
        Row: {
          consumo_medio_km_l: number | null
          custo_por_km: number | null
          despesa_pessoal: number | null
          despesa_total: number | null
          despesa_veiculo: number | null
          fim_em: string | null
          inicio_em: string | null
          km_total: number | null
          lucro_liquido: number | null
          piloto_id: string | null
          receita_total: number | null
          status: Database["public"]["Enums"]["status_viagem"] | null
          viagem_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viagem_piloto_id_fkey"
            columns: ["piloto_id"]
            isOneToOne: false
            referencedRelation: "piloto"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      pull_changes: { Args: { last_pulled_at?: number }; Returns: Json }
      push_changes: {
        Args: { changes: Json; last_pulled_at?: number }
        Returns: undefined
      }
      sync_out: { Args: { r: Json }; Returns: Json }
      sync_tables: { Args: never; Returns: string[] }
      sync_writable_tables: { Args: never; Returns: string[] }
      uuid_generate_v7: { Args: never; Returns: string }
    }
    Enums: {
      aplica_documento: "VEICULO" | "PILOTO"
      carroceria_veiculo:
        | "BAU"
        | "SIDER"
        | "GRANELEIRO"
        | "CACAMBA"
        | "TANQUE"
        | "FRIGORIFICA"
        | "PRANCHA"
        | "PORTA_CONTAINER"
        | "CEGONHA"
        | "SILO"
        | "NAO_APLICA"
      escopo_categoria: "VEICULO" | "PESSOAL" | "ADMIN"
      forma_pagamento:
        | "DINHEIRO"
        | "PIX"
        | "CARTAO_CREDITO"
        | "CARTAO_DEBITO"
        | "CARTAO_FRETE"
        | "BOLETO"
        | "TRANSFERENCIA"
        | "FATURADO"
      natureza_veiculo: "TRACAO" | "REBOQUE"
      responsavel_pedagio: "EMBARCADOR" | "TRANSPORTADOR"
      status_despesa: "PENDENTE" | "CONFIRMADA" | "CANCELADA"
      status_frete:
        | "RASCUNHO"
        | "CONTRATADO"
        | "EM_ANDAMENTO"
        | "CONCLUIDO"
        | "CANCELADO"
      status_viagem:
        | "PLANEJADA"
        | "EM_ANDAMENTO"
        | "PAUSADA"
        | "CONCLUIDA"
        | "CANCELADA"
      tipo_combustivel:
        | "DIESEL_S10"
        | "DIESEL_S500"
        | "ARLA32"
        | "GNV"
        | "ETANOL"
        | "GASOLINA"
      tipo_estabelecimento:
        | "POSTO"
        | "OFICINA"
        | "BORRACHARIA"
        | "RESTAURANTE"
        | "HOTEL"
        | "PEDAGIO"
        | "BALANCA"
        | "OUTRO"
      tipo_manutencao:
        | "PREVENTIVA"
        | "CORRETIVA"
        | "REVISAO"
        | "PNEU"
        | "TROCA_OLEO"
      tipo_parada:
        | "CARREGAMENTO"
        | "DESCARGA"
        | "ABASTECIMENTO"
        | "DESCANSO"
        | "PEDAGIO"
        | "BALANCA"
        | "FRONTEIRA"
        | "MANUTENCAO"
        | "OUTRO"
      tipo_receita:
        | "ADIANTAMENTO"
        | "SALDO"
        | "EXTRA"
        | "ESTADIA"
        | "DEVOLUCAO_PEDAGIO"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      aplica_documento: ["VEICULO", "PILOTO"],
      carroceria_veiculo: [
        "BAU",
        "SIDER",
        "GRANELEIRO",
        "CACAMBA",
        "TANQUE",
        "FRIGORIFICA",
        "PRANCHA",
        "PORTA_CONTAINER",
        "CEGONHA",
        "SILO",
        "NAO_APLICA",
      ],
      escopo_categoria: ["VEICULO", "PESSOAL", "ADMIN"],
      forma_pagamento: [
        "DINHEIRO",
        "PIX",
        "CARTAO_CREDITO",
        "CARTAO_DEBITO",
        "CARTAO_FRETE",
        "BOLETO",
        "TRANSFERENCIA",
        "FATURADO",
      ],
      natureza_veiculo: ["TRACAO", "REBOQUE"],
      responsavel_pedagio: ["EMBARCADOR", "TRANSPORTADOR"],
      status_despesa: ["PENDENTE", "CONFIRMADA", "CANCELADA"],
      status_frete: [
        "RASCUNHO",
        "CONTRATADO",
        "EM_ANDAMENTO",
        "CONCLUIDO",
        "CANCELADO",
      ],
      status_viagem: [
        "PLANEJADA",
        "EM_ANDAMENTO",
        "PAUSADA",
        "CONCLUIDA",
        "CANCELADA",
      ],
      tipo_combustivel: [
        "DIESEL_S10",
        "DIESEL_S500",
        "ARLA32",
        "GNV",
        "ETANOL",
        "GASOLINA",
      ],
      tipo_estabelecimento: [
        "POSTO",
        "OFICINA",
        "BORRACHARIA",
        "RESTAURANTE",
        "HOTEL",
        "PEDAGIO",
        "BALANCA",
        "OUTRO",
      ],
      tipo_manutencao: [
        "PREVENTIVA",
        "CORRETIVA",
        "REVISAO",
        "PNEU",
        "TROCA_OLEO",
      ],
      tipo_parada: [
        "CARREGAMENTO",
        "DESCARGA",
        "ABASTECIMENTO",
        "DESCANSO",
        "PEDAGIO",
        "BALANCA",
        "FRONTEIRA",
        "MANUTENCAO",
        "OUTRO",
      ],
      tipo_receita: [
        "ADIANTAMENTO",
        "SALDO",
        "EXTRA",
        "ESTADIA",
        "DEVOLUCAO_PEDAGIO",
      ],
    },
  },
} as const

