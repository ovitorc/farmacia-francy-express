CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Usuario ve seus proprios papeis" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.categorias (
  slug text PRIMARY KEY,
  nome text NOT NULL,
  icone text NOT NULL DEFAULT 'ETIQUETA',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categorias TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categorias sao publicas" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Admin gerencia categorias" ON public.categorias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.subcategorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_slug text NOT NULL REFERENCES public.categorias(slug) ON DELETE CASCADE,
  slug text NOT NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (categoria_slug, slug)
);
GRANT SELECT ON public.subcategorias TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subcategorias TO authenticated;
GRANT ALL ON public.subcategorias TO service_role;
ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subcategorias sao publicas" ON public.subcategorias FOR SELECT USING (true);
CREATE POLICY "Admin gerencia subcategorias" ON public.subcategorias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  categoria_slug text NOT NULL REFERENCES public.categorias(slug) ON DELETE RESTRICT,
  subcategoria_slug text NOT NULL DEFAULT '',
  preco numeric(10,2) NOT NULL DEFAULT 0,
  preco_promocional numeric(10,2),
  imagem text,
  disponivel boolean NOT NULL DEFAULT true,
  oferta boolean NOT NULL DEFAULT false,
  rasga_preco boolean NOT NULL DEFAULT false,
  informacoes text[] NOT NULL DEFAULT '{}',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX produtos_categoria_idx ON public.produtos (categoria_slug);
CREATE TRIGGER produtos_set_updated_at BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.produtos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Produtos sao publicos" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "Admin gerencia produtos" ON public.produtos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin envia fotos de produtos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'produtos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin le fotos de produtos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'produtos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza fotos de produtos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'produtos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin remove fotos de produtos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'produtos' AND public.has_role(auth.uid(), 'admin'));

INSERT INTO public.categorias (slug, nome, icone, ordem) VALUES
('medicamentos', 'Medicamentos', '💊', 0),
('perfumaria-e-cosmeticos', 'Perfumaria e Cosméticos', '🧴', 1),
('higiene-pessoal', 'Higiene Pessoal', '🧼', 2),
('cuidados-com-bebes-e-criancas', 'Cuidados com Bebês e Crianças', '🍼', 3),
('saude-e-primeiros-socorros', 'Saúde e Primeiros Socorros', '🩹', 4),
('vitaminas-e-suplementos', 'Vitaminas e Suplementos', '🍊', 5),
('higiene-e-cuidados-intimos', 'Higiene e Cuidados Íntimos', '🌸', 6),
('ortopedia-e-cuidados-especiais', 'Ortopedia e Cuidados Especiais', '🦵', 7),
('beleza-e-cuidados-pessoais', 'Beleza e Cuidados Pessoais', '💄', 8),
('produtos-para-idosos-e-incontinencia', 'Produtos para Idosos e Incontinência', '🧓', 9),
('saude-bucal', 'Saúde Bucal', '🦷', 10),
('conveniencia-e-alimentos', 'Conveniência e Alimentos', '🍫', 11),
('produtos-para-animais-pet', 'Produtos para Animais (Pet)', '🐾', 12),
('utilidades-e-acessorios', 'Utilidades e Acessórios', '🔌', 13);

INSERT INTO public.subcategorias (categoria_slug, slug, nome, ordem) VALUES
('medicamentos', 'analgesicos', 'Analgésicos', 0),
('medicamentos', 'antialergicos', 'Antialérgicos', 1),
('medicamentos', 'antigripais', 'Antigripais', 2),
('medicamentos', 'digestivos', 'Digestivos', 3),
('medicamentos', 'vitaminas', 'Vitaminas', 4),
('medicamentos', 'uso-continuo', 'Uso contínuo', 5),
('medicamentos', 'outros', 'Outros', 6),
('perfumaria-e-cosmeticos', 'perfumes', 'Perfumes', 0),
('perfumaria-e-cosmeticos', 'cremes', 'Cremes', 1),
('perfumaria-e-cosmeticos', 'protetor-solar', 'Protetor solar', 2),
('perfumaria-e-cosmeticos', 'maquiagem', 'Maquiagem', 3),
('perfumaria-e-cosmeticos', 'cuidados-com-o-cabelo', 'Cuidados com o cabelo', 4),
('perfumaria-e-cosmeticos', 'cuidados-com-a-pele', 'Cuidados com a pele', 5),
('higiene-pessoal', 'sabonetes', 'Sabonetes', 0),
('higiene-pessoal', 'desodorantes', 'Desodorantes', 1),
('higiene-pessoal', 'shampoos', 'Shampoos', 2),
('higiene-pessoal', 'higiene-intima', 'Higiene íntima', 3),
('higiene-pessoal', 'higiene-oral', 'Higiene oral', 4),
('cuidados-com-bebes-e-criancas', 'fraldas', 'Fraldas', 0),
('cuidados-com-bebes-e-criancas', 'lencos-umedecidos', 'Lenços umedecidos', 1),
('cuidados-com-bebes-e-criancas', 'higiene-infantil', 'Higiene infantil', 2),
('cuidados-com-bebes-e-criancas', 'cuidados-com-a-pele', 'Cuidados com a pele', 3),
('cuidados-com-bebes-e-criancas', 'alimentacao-infantil', 'Alimentação infantil', 4),
('saude-e-primeiros-socorros', 'curativos', 'Curativos', 0),
('saude-e-primeiros-socorros', 'alcool', 'Álcool', 1),
('saude-e-primeiros-socorros', 'termometros', 'Termômetros', 2),
('saude-e-primeiros-socorros', 'ataduras', 'Ataduras', 3),
('saude-e-primeiros-socorros', 'antissepticos', 'Antissépticos', 4),
('vitaminas-e-suplementos', 'multivitaminicos', 'Multivitamínicos', 0),
('vitaminas-e-suplementos', 'vitamina-c', 'Vitamina C', 1),
('vitaminas-e-suplementos', 'vitamina-d', 'Vitamina D', 2),
('vitaminas-e-suplementos', 'minerais', 'Minerais', 3),
('vitaminas-e-suplementos', 'suplementos', 'Suplementos', 4),
('higiene-e-cuidados-intimos', 'absorventes', 'Absorventes', 0),
('higiene-e-cuidados-intimos', 'protetores-diarios', 'Protetores diários', 1),
('higiene-e-cuidados-intimos', 'sabonetes-intimos', 'Sabonetes íntimos', 2),
('higiene-e-cuidados-intimos', 'incontinencia', 'Incontinência', 3),
('ortopedia-e-cuidados-especiais', 'joelheiras', 'Joelheiras', 0),
('ortopedia-e-cuidados-especiais', 'cintas', 'Cintas', 1),
('ortopedia-e-cuidados-especiais', 'meias-de-compressao', 'Meias de compressão', 2),
('ortopedia-e-cuidados-especiais', 'bengalas', 'Bengalas', 3),
('ortopedia-e-cuidados-especiais', 'suportes', 'Suportes', 4),
('beleza-e-cuidados-pessoais', 'cremes', 'Cremes', 0),
('beleza-e-cuidados-pessoais', 'produtos-capilares', 'Produtos capilares', 1),
('beleza-e-cuidados-pessoais', 'cuidados-faciais', 'Cuidados faciais', 2),
('beleza-e-cuidados-pessoais', 'cuidados-corporais', 'Cuidados corporais', 3),
('produtos-para-idosos-e-incontinencia', 'fraldas-adultas', 'Fraldas adultas', 0),
('produtos-para-idosos-e-incontinencia', 'absorventes', 'Absorventes', 1),
('produtos-para-idosos-e-incontinencia', 'produtos-de-cuidado-pessoal', 'Produtos de cuidado pessoal', 2),
('saude-bucal', 'cremes-dentais', 'Cremes dentais', 0),
('saude-bucal', 'escovas', 'Escovas', 1),
('saude-bucal', 'enxaguantes', 'Enxaguantes', 2),
('saude-bucal', 'fio-dental', 'Fio dental', 3),
('conveniencia-e-alimentos', 'balas', 'Balas', 0),
('conveniencia-e-alimentos', 'chocolates', 'Chocolates', 1),
('conveniencia-e-alimentos', 'snacks', 'Snacks', 2),
('conveniencia-e-alimentos', 'bebidas', 'Bebidas', 3),
('conveniencia-e-alimentos', 'outros-produtos', 'Outros produtos', 4),
('produtos-para-animais-pet', 'higiene', 'Higiene', 0),
('produtos-para-animais-pet', 'cuidados', 'Cuidados', 1),
('produtos-para-animais-pet', 'acessorios', 'Acessórios', 2),
('produtos-para-animais-pet', 'produtos-para-pets', 'Produtos para pets', 3),
('utilidades-e-acessorios', 'pilhas', 'Pilhas', 0),
('utilidades-e-acessorios', 'acessorios', 'Acessórios', 1),
('utilidades-e-acessorios', 'pequenos-itens-de-utilidade', 'Pequenos itens de utilidade', 2);

INSERT INTO public.produtos (codigo, nome, descricao, categoria_slug, subcategoria_slug, preco, preco_promocional, imagem, disponivel, oferta, rasga_preco, informacoes, ordem) VALUES
('FF-1001', 'Loratamed Loratadina 10mg 12 comprimidos', 'Antialérgico com loratadina 10 mg, indicado para o alívio dos sintomas de alergia como coceira, espirros e coriza. Uso oral adulto e pediátrico acima de 12 anos.', 'medicamentos', 'antialergicos', 5.99, 3.99, '/__l5e/assets-v1/ac72c396-caec-4ee6-934d-421318edf091/loratamed.png', true, true, true, ARRAY['12 comprimidos','24h de ação','Uso oral']::text[], 0),
('FF-1002', 'Dorflex 10 comprimidos', 'Analgésico e relaxante muscular em cartela com 10 comprimidos, indicado para o alívio de dores associadas a contraturas musculares.', 'medicamentos', 'analgesicos', 10.9, 8.72, '/__l5e/assets-v1/21568608-a9ce-4106-b41d-b29353829b95/dorflex_cartela.png', true, true, true, ARRAY['Cartela com 10 comprimidos','Analgésico e relaxante muscular']::text[], 1),
('FF-1003', 'Absorvente Sempre Livre Adapt Suave com Abas Leve 16 Pague 14', 'Absorvente com cobertura suave e abas, rápida absorção e até 6h de proteção. Embalagem leve 16 pague 14 unidades.', 'higiene-e-cuidados-intimos', 'absorventes', 18.9, 15.99, '/__l5e/assets-v1/8bc2bf43-5f32-4078-a4ab-dc8fbae05e81/abs_aways.png', true, true, true, ARRAY['16 unidades','Cobertura suave com abas','Até 6h de proteção']::text[], 2);

INSERT INTO public.produtos (codigo, nome, descricao, categoria_slug, subcategoria_slug, preco, preco_promocional, disponivel, oferta, rasga_preco, ordem)
SELECT v.codigo, v.nome,
       v.nome || '. Produto demonstrativo do catálogo da Farmácias Francy. Confirme disponibilidade e apresentação pelo WhatsApp.',
       v.categoria, v.subcategoria, v.preco, v.promo, true, v.oferta, v.rasga, v.ordem
FROM (VALUES
('FF-1004','Dipirona Sódica 500mg 10 comprimidos','medicamentos','analgesicos',6.5,4.99,true,true,3),
('FF-1005','Paracetamol 750mg 20 comprimidos','medicamentos','analgesicos',12.9,null,false,false,4),
('FF-1006','Antigripal Dia e Noite 12 comprimidos','medicamentos','antigripais',21.9,17.49,true,true,5),
('FF-1007','Antiácido Efervescente 6 envelopes','medicamentos','digestivos',9.9,null,false,false,6),
('FF-1008','Losartana Potássica 50mg 30 comprimidos','medicamentos','uso-continuo',14.9,11.9,true,true,7),
('FF-1009','Soro Fisiológico 100ml','medicamentos','outros',5.5,null,false,false,8),
('FF-1010','Perfume Floral Deo Colônia 100ml','perfumaria-e-cosmeticos','perfumes',89.9,69.9,true,true,9),
('FF-1011','Creme Hidratante Corporal 400ml','perfumaria-e-cosmeticos','cremes',32.9,null,false,false,10),
('FF-1012','Protetor Solar FPS 50 120ml','perfumaria-e-cosmeticos','protetor-solar',59.9,47.9,true,true,11),
('FF-1013','Base Líquida Cobertura Natural','perfumaria-e-cosmeticos','maquiagem',39.9,null,false,false,12),
('FF-1014','Sabonete Hidratante em Barra 90g','higiene-pessoal','sabonetes',3.49,2.79,true,true,13),
('FF-1015','Desodorante Aerosol 150ml','higiene-pessoal','desodorantes',18.9,null,false,false,14),
('FF-1016','Shampoo Anticaspa 400ml','higiene-pessoal','shampoos',26.9,21.9,true,true,15),
('FF-1017','Fralda Infantil Confort M 40 unidades','cuidados-com-bebes-e-criancas','fraldas',49.9,42.9,true,false,16),
('FF-1018','Lenços Umedecidos 75 unidades','cuidados-com-bebes-e-criancas','lencos-umedecidos',12.9,null,false,false,17),
('FF-1019','Pomada para Assaduras 45g','cuidados-com-bebes-e-criancas','cuidados-com-a-pele',22.9,null,false,false,18),
('FF-1020','Curativo Adesivo 20 unidades','saude-e-primeiros-socorros','curativos',8.9,6.99,true,true,19),
('FF-1021','Álcool 70% Líquido 1L','saude-e-primeiros-socorros','alcool',11.9,null,false,false,20),
('FF-1022','Termômetro Digital','saude-e-primeiros-socorros','termometros',29.9,24.9,true,true,21),
('FF-1023','Atadura de Crepe 10cm','saude-e-primeiros-socorros','ataduras',4.9,null,false,false,22),
('FF-1024','Multivitamínico A-Z 60 cápsulas','vitaminas-e-suplementos','multivitaminicos',45.9,36.9,true,true,23),
('FF-1025','Vitamina C 1g 10 comprimidos efervescentes','vitaminas-e-suplementos','vitamina-c',19.9,null,false,false,24),
('FF-1026','Vitamina D 2000UI 30 cápsulas','vitaminas-e-suplementos','vitamina-d',34.9,null,false,false,25),
('FF-1027','Protetor Diário Sem Perfume 40 unidades','higiene-e-cuidados-intimos','protetores-diarios',14.9,11.99,true,false,26),
('FF-1028','Sabonete Íntimo 200ml','higiene-e-cuidados-intimos','sabonetes-intimos',24.9,null,false,false,27),
('FF-1029','Joelheira Elástica Tamanho M','ortopedia-e-cuidados-especiais','joelheiras',39.9,null,false,false,28),
('FF-1030','Meia de Compressão 20-30mmHg','ortopedia-e-cuidados-especiais','meias-de-compressao',89.9,74.9,true,true,29),
('FF-1031','Creme Facial Antissinais 50g','beleza-e-cuidados-pessoais','cuidados-faciais',64.9,52.9,true,false,30),
('FF-1032','Condicionador Reparação 350ml','beleza-e-cuidados-pessoais','produtos-capilares',27.9,null,false,false,31),
('FF-1033','Fralda Geriátrica G 8 unidades','produtos-para-idosos-e-incontinencia','fraldas-adultas',32.9,27.9,true,false,32),
('FF-1034','Absorvente para Incontinência 16 unidades','produtos-para-idosos-e-incontinencia','absorventes',21.9,null,false,false,33),
('FF-1035','Creme Dental Proteção Total 90g','saude-bucal','cremes-dentais',9.9,7.49,true,false,34),
('FF-1036','Escova Dental Macia','saude-bucal','escovas',12.9,null,false,false,35),
('FF-1037','Enxaguante Bucal Sem Álcool 500ml','saude-bucal','enxaguantes',22.9,18.9,true,false,36),
('FF-1038','Fio Dental 50m','saude-bucal','fio-dental',8.9,null,false,false,37),
('FF-1039','Chocolate ao Leite 90g','conveniencia-e-alimentos','chocolates',8.49,null,false,false,38),
('FF-1040','Bala de Menta Sem Açúcar','conveniencia-e-alimentos','balas',4.99,null,false,false,39),
('FF-1041','Água Mineral 500ml','conveniencia-e-alimentos','bebidas',3.5,null,false,false,40),
('FF-1042','Shampoo Pet Filhotes 500ml','produtos-para-animais-pet','higiene',29.9,24.9,true,true,41),
('FF-1043','Coleira Antipulgas','produtos-para-animais-pet','acessorios',44.9,null,false,false,42),
('FF-1044','Pilha Alcalina AA 4 unidades','utilidades-e-acessorios','pilhas',19.9,15.9,true,true,43),
('FF-1045','Copo Dosador Graduado','utilidades-e-acessorios','pequenos-itens-de-utilidade',5.9,null,false,false,44)
) AS v(codigo, nome, categoria, subcategoria, preco, promo, oferta, rasga, ordem);

-- ============================================================
-- BANNERS DA HOME
-- ============================================================

CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  imagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX banners_ativo_ordem_idx
ON public.banners (ativo, ordem);

CREATE TRIGGER banners_set_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Banners ativos sao publicos"
ON public.banners
FOR SELECT
USING (ativo = true);

CREATE POLICY "Admin gerencia banners"
ON public.banners
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));