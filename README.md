# Central de Fisiologia — Grêmio Novorizontino

Dashboard de monitoramento de carga e performance do Sub-20.

## Stack

- **Next.js 16** — framework
- **Vercel Postgres (Neon)** — banco de dados para sessões GPS
- **Google Sheets** — fonte do bem-estar e sRPE (via CSV público)
- **Vercel** — hospedagem

---

## Setup completo (do zero ao ar)

### 1. Fork e deploy inicial

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/dashboard-fisiologia
cd dashboard-fisiologia
npm install

# Suba pro GitHub e conecte ao Vercel
# Em: https://vercel.com/new
```

### 2. Criar o banco de dados (Vercel Postgres)

No painel do Vercel:
1. Acesse seu projeto → aba **Storage**
2. Clique em **Create Database** → escolha **Postgres (Neon)**
3. Nome: `fisiologia-gn` (ou qualquer nome)
4. As variáveis de ambiente (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, etc.) são adicionadas **automaticamente** ao projeto

### 3. Criar a tabela

Ainda no painel do Vercel → Storage → seu banco → aba **Query**:

```sql
CREATE TABLE IF NOT EXISTS gps_sessions (
  id          SERIAL PRIMARY KEY,
  session_date VARCHAR(20) NOT NULL,
  filename    VARCHAR(255),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  rows        JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_sessions_date_unique
  ON gps_sessions (session_date);
```

> O arquivo `schema.sql` na raiz do projeto contém esse mesmo SQL.

### 4. Variáveis de ambiente locais

```bash
cp .env.example .env.local
# Preencha com as vars do Vercel Postgres
# (copie de: Vercel → Storage → seu banco → .env.local)
```

### 5. Rodar localmente

```bash
npm run dev
# http://localhost:3000
```

---

## Fluxo de uso

```
1. Baixar CSV da Catapult após o treino
2. Entrar no dashboard → página inicial
3. Clicar em "Upload CSV" ou arrastar o arquivo
4. Sistema parseia, detecta outliers, salva no banco
5. Dados disponíveis em qualquer dispositivo, para sempre
```

---

## Fontes de dados

| Fonte | Tipo | Como alimentar |
|---|---|---|
| **GPS (Catapult)** | Vercel Postgres | Upload CSV no dashboard |
| **Bem-Estar + sRPE** | Google Sheets | Auto-fetch via URL pública |

## Métricas calculadas automaticamente

- **Vmax baseline** → maior velocidade histórica por atleta (todas as sessões no banco)
- **% Vmax** → sessão atual / Vmax baseline × 100
- **Wellness Score** → média(sono, 6-fadiga, 6-doms, 6-estresse, humor)
- **sRPE-Load** → sRPE × duração (UA)
- **Monotonia** → média diária / desvio-padrão
- **Strain** → carga semanal × monotonia
- **ACWR** → semana atual / média 3 semanas anteriores
- **Outlier GPS** → distância > média+3σ ou > 15.000m → ignorados automaticamente

## Credenciais padrão

- **Usuário:** `bigdatanovorizontino`
- **Senha:** `gremio123`

> Altere em `app/api/auth/[...nextauth]/route.js`

