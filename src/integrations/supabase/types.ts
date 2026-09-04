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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      banners: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          imagem: string
          imagem_mobile: string | null
          link: string | null
          ordem: number
          titulo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          imagem: string
          imagem_mobile?: string | null
          link?: string | null
          ordem?: number
          titulo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          imagem?: string
          imagem_mobile?: string | null
          link?: string | null
          ordem?: number
          titulo?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string
          icone: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          created_at?: string
          icone?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          created_at?: string
          icone?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      imagem_sync_logs: {
        Row: {
          confidence: number | null
          ean: string | null
          error: string | null
          finished_at: string
          id: string
          image_url: string | null
          produto_id: string | null
          source: string | null
          started_at: string
          status: string
        }
        Insert: {
          confidence?: number | null
          ean?: string | null
          error?: string | null
          finished_at?: string
          id?: string
          image_url?: string | null
          produto_id?: string | null
          source?: string | null
          started_at?: string
          status: string
        }
        Update: {
          confidence?: number | null
          ean?: string | null
          error?: string | null
          finished_at?: string
          id?: string
          image_url?: string | null
          produto_id?: string | null
          source?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "imagem_sync_logs_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      import_estoque_stage: {
        Row: {
          batch_id: string
          codigo: string
          codigo_barras: string | null
          created_at: string
          estoque: number | null
          fabricante: string | null
          id: number
          nome: string | null
          preco: number | null
          preco_promocional: number | null
          unidade: string | null
        }
        Insert: {
          batch_id: string
          codigo: string
          codigo_barras?: string | null
          created_at?: string
          estoque?: number | null
          fabricante?: string | null
          id?: number
          nome?: string | null
          preco?: number | null
          preco_promocional?: number | null
          unidade?: string | null
        }
        Update: {
          batch_id?: string
          codigo?: string
          codigo_barras?: string | null
          created_at?: string
          estoque?: number | null
          fabricante?: string | null
          id?: number
          nome?: string | null
          preco?: number | null
          preco_promocional?: number | null
          unidade?: string | null
        }
        Relationships: []
      }
      importacao_francy: {
        Row: {
          categoria_slug: string | null
          codigo: string
          codigo_barras: string | null
          descricao: string | null
          disponivel: boolean | null
          estoque: number | null
          fabricante: string | null
          farmacia_popular: boolean | null
          medicamento: string | null
          nome: string | null
          preco: number | null
          preco_farmacia_popular: number | null
          preco_promocional: number | null
          principio_ativo: string | null
          registro_ms: string | null
          retem_receita: string | null
          subcategoria_slug: string | null
          tarja: string | null
          unidade: string | null
        }
        Insert: {
          categoria_slug?: string | null
          codigo: string
          codigo_barras?: string | null
          descricao?: string | null
          disponivel?: boolean | null
          estoque?: number | null
          fabricante?: string | null
          farmacia_popular?: boolean | null
          medicamento?: string | null
          nome?: string | null
          preco?: number | null
          preco_farmacia_popular?: number | null
          preco_promocional?: number | null
          principio_ativo?: string | null
          registro_ms?: string | null
          retem_receita?: string | null
          subcategoria_slug?: string | null
          tarja?: string | null
          unidade?: string | null
        }
        Update: {
          categoria_slug?: string | null
          codigo?: string
          codigo_barras?: string | null
          descricao?: string | null
          disponivel?: boolean | null
          estoque?: number | null
          fabricante?: string | null
          farmacia_popular?: boolean | null
          medicamento?: string | null
          nome?: string | null
          preco?: number | null
          preco_farmacia_popular?: number | null
          preco_promocional?: number | null
          principio_ativo?: string | null
          registro_ms?: string | null
          retem_receita?: string | null
          subcategoria_slug?: string | null
          tarja?: string | null
          unidade?: string | null
        }
        Relationships: []
      }
      produtos: {
        Row: {
          categoria_slug: string
          codigo: string
          codigo_barras: string | null
          created_at: string
          descricao: string
          disponivel: boolean
          estoque: number
          fabricante: string
          farmacia_popular: boolean
          id: string
          image_candidato_url: string | null
          image_confidence: number | null
          image_error: string | null
          image_format: string | null
          image_hash: string | null
          image_height: number | null
          image_last_synced_at: string | null
          image_license: string | null
          image_source: string | null
          image_source_url: string | null
          image_status: string
          image_width: number | null
          imagem: string | null
          informacoes: string[]
          nome: string
          oferta: boolean
          ordem: number
          preco: number
          preco_farmacia_popular: number | null
          preco_promocional: number | null
          principio_ativo: string
          rasga_preco: boolean
          registro_ms: string
          subcategoria_slug: string
          unidade: string
          updated_at: string
        }
        Insert: {
          categoria_slug: string
          codigo: string
          codigo_barras?: string | null
          created_at?: string
          descricao?: string
          disponivel?: boolean
          estoque?: number
          fabricante?: string
          farmacia_popular?: boolean
          id?: string
          image_candidato_url?: string | null
          image_confidence?: number | null
          image_error?: string | null
          image_format?: string | null
          image_hash?: string | null
          image_height?: number | null
          image_last_synced_at?: string | null
          image_license?: string | null
          image_source?: string | null
          image_source_url?: string | null
          image_status?: string
          image_width?: number | null
          imagem?: string | null
          informacoes?: string[]
          nome: string
          oferta?: boolean
          ordem?: number
          preco?: number
          preco_farmacia_popular?: number | null
          preco_promocional?: number | null
          principio_ativo?: string
          rasga_preco?: boolean
          registro_ms?: string
          subcategoria_slug?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          categoria_slug?: string
          codigo?: string
          codigo_barras?: string | null
          created_at?: string
          descricao?: string
          disponivel?: boolean
          estoque?: number
          fabricante?: string
          farmacia_popular?: boolean
          id?: string
          image_candidato_url?: string | null
          image_confidence?: number | null
          image_error?: string | null
          image_format?: string | null
          image_hash?: string | null
          image_height?: number | null
          image_last_synced_at?: string | null
          image_license?: string | null
          image_source?: string | null
          image_source_url?: string | null
          image_status?: string
          image_width?: number | null
          imagem?: string | null
          informacoes?: string[]
          nome?: string
          oferta?: boolean
          ordem?: number
          preco?: number
          preco_farmacia_popular?: number | null
          preco_promocional?: number | null
          principio_ativo?: string
          rasga_preco?: boolean
          registro_ms?: string
          subcategoria_slug?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_slug_fkey"
            columns: ["categoria_slug"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      subcategorias: {
        Row: {
          categoria_slug: string
          created_at: string
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          categoria_slug: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          categoria_slug?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_categoria_slug_fkey"
            columns: ["categoria_slug"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_estoque_aplicar: { Args: { _batch: string }; Returns: Json }
      import_estoque_resumo: { Args: { _batch: string }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin"
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
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
