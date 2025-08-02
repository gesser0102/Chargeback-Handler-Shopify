# 🔄 Chargeback Webhook Handler

Uma Azure Function robusta para processar webhooks de chargeback do Shopify, com integração completa para notificações no Slack e persistência de dados em banco MySQL.

## 🎯 **Visão Geral**

Esta aplicação é um webhook handler especializado em processar disputas de chargeback do Shopify. Quando uma disputa é criada, a função:

- ✅ Valida a assinatura HMAC do webhook
- ✅ Processa os dados do chargeback
- ✅ Busca informações da order no Shopify
- ✅ Atualiza tags do customer baseado no histórico
- ✅ Envia notificações para o Slack
- ✅ Persiste logs de erro no banco de dados
- ✅ **Detecção automática de ambiente**
- ✅ **Sistema de logging otimizado por ambiente**

## 🏗️ **Arquitetura**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Shopify       │    │  Azure Function  │    │   Database      │
│   Webhook       │───▶│  Chargeback      │───▶│   MySQL         │
│                 │    │  Handler         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Slack       │
                       │  Notifications  │
                       └─────────────────┘
```

## 🚀 **Tecnologias**

- **Runtime**: Node.js 20+
- **Framework**: Azure Functions v4
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Database**: MySQL
- **Notifications**: Slack API
- **Authentication**: Shopify HMAC

## 📁 **Estrutura do Projeto**

```
src/
├── ChargebackWebhook/
│   └── index.ts              # Função principal
├── services/
│   ├── chargebackService.ts  # Lógica de processamento
│   ├── databaseService.ts    # Conexão com MySQL
│   ├── shopifyService.ts     # API do Shopify
│   └── slackService.ts       # Notificações Slack
├── types/
│   ├── azure.ts             # Tipos do Azure Functions
│   ├── chargeback.ts        # Tipos de chargeback
│   └── shopify.ts           # Tipos do Shopify
└── utils/
    ├── webhookValidator.ts  # Validação HMAC
    ├── environmentDetector.ts # Detecção automática de ambiente
    └── logger.ts            # Sistema de logging centralizado
```

## 🌍 **Sistema de Detecção Automática de Ambiente**

### **Detecção Inteligente**
A aplicação detecta automaticamente se está rodando em **desenvolvimento** ou **produção** sem necessidade de configuração manual:

```typescript
// Detecção baseada no contexto de execução
const environment = getEnvironmentWithoutRequest();
// Retorna: 'development' ou 'production'
```

### **Critérios de Detecção**

**🔄 Desenvolvimento (Logs Detalhados):**
- Azure Functions local (`func start`)
- Storage local (`UseDevelopmentStorage=true`)
- Ambiente de desenvolvimento (`AZURE_FUNCTIONS_ENVIRONMENT=Development`)

**🚀 Produção (Logs Otimizados):**
- Azure Functions em nuvem
- Storage Azure
- Ambiente de produção

## 📝 **Sistema de Logging Centralizado**

### **Logger Inteligente**
Sistema de logging que se adapta automaticamente ao ambiente:

```typescript
import { Logger } from '../utils/logger';

// Logs que aparecem apenas em desenvolvimento
Logger.debug('Dados detalhados...');
Logger.process('Processando chargeback...');
Logger.customer('Dados do customer...');
Logger.webhook('Dados do webhook...');

// Logs que aparecem sempre (dev + produção)
Logger.info('Informação importante');
Logger.success('Operação concluída');
Logger.warn('Aviso importante');
Logger.error('Erro crítico');
```

### **Benefícios do Sistema**
- ✅ **Redução de 70-80%** dos logs em produção
- ⚡ **Melhor performance** em execuções
- 💰 **Menor custo** na Azure
- 🎯 **Logs mais limpos** e organizados

### **Comportamento por Ambiente**

**🏠 Desenvolvimento Local:**
```typescript
Logger.debug('Dados detalhados...');    // ✅ Exibido
Logger.process('Processando...');       // ✅ Exibido
Logger.customer('Dados customer...');   // ✅ Exibido
Logger.webhook('Dados webhook...');     // ✅ Exibido
```

**☁️ Produção Azure:**
```typescript
Logger.debug('Dados detalhados...');    // ❌ Não exibido
Logger.process('Processando...');       // ❌ Não exibido
Logger.customer('Dados customer...');   // ❌ Não exibido
Logger.webhook('Dados webhook...');     // ❌ Não exibido
Logger.info('Importante');              // ✅ Sempre exibido
Logger.error('Erro crítico');           // ✅ Sempre exibido
```

## ⚙️ **Configuração**

### **Variáveis de Ambiente**

```bash
# Shopify
SHOPIFY_WEBHOOK_SECRET=your_api_secret
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_access_token

# Slack
SLACK_BOT_TOKEN=you_slack_bot_token
SLACK_CHANNEL_ID=C-your-channel-id

# Database
DB_HOST=your-db-host
DB_PORT=your-db-port
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_DATABASE=your-db-name
```

### **Instalação Local**

```bash
# Clonar o repositório
git clone <repository-url>
cd chargebakcs

# Instalar dependências
pnpm install

# Configurar variáveis
cp local.settings.json.example local.settings.json
# Editar local.settings.json com suas credenciais

# Build do projeto
pnpm run build

# Executar localmente
pnpm run start
```

## 🔧 **Desenvolvimento**

### **Comandos Disponíveis**

```bash
# Build do projeto
pnpm run build

# Executar localmente
pnpm run start

# Limpar build
pnpm run clean

# Watch mode
pnpm run watch
```

### **Estrutura de Tipos**

A aplicação usa uma estrutura de tipos centralizada para evitar problemas de importação com `@azure/functions`:

```typescript
// src/types/azure.ts
export interface HttpRequest {
  headers: { get(name: string): string | null; };
  text(): Promise<string>;
}

export interface HttpResponseInit {
  status?: number;
  body?: any;
}

export interface InvocationContext {
  log(message: string, ...args: any[]): void;
  error(message: string, error?: any): void;
}
```

## 🚀 **Deploy**

### **Azure Functions Extension (Recomendado)**

1. Instale as extensões do VS Code:
   - Azure Functions
   - Azure App Service
   - TypeScript

2. Faça login no Azure:
   ```
   Ctrl+Shift+P → Azure: Sign In
   ```

3. Deploy:
   ```
   Ctrl+Shift+P → Azure Functions: Deploy to Function App
   ```

### **Deploy Manual**

```bash
# Build
pnpm run build

# Deploy
func azure functionapp publish your-function-name --build remote
```

### **Deploy via Portal**

1. Build local: `pnpm run build`
2. Compactar pasta `dist/`
3. Upload no Azure Portal → Function App → Deployment Center

## 📊 **Fluxo de Processamento**

### **1. Recebimento do Webhook**
```
Shopify → Azure Function → Validação HMAC
```

### **2. Validação de Segurança**
```
✅ Verificar assinatura HMAC
✅ Validar headers obrigatórios
✅ Parse do JSON
```

### **3. Processamento do Chargeback**
```
📦 Buscar order no Shopify
👤 Verificar histórico do customer
🏷️ Atualizar tags baseado no risco
📊 Persistir dados no banco
```

### **4. Notificações**
```
🔔 Slack: Notificação detalhada
📝 Database: Log de erros
📊 Métricas: Monitoramento
```

## 🔒 **Segurança**

### **Validação HMAC**
- Verifica assinatura do webhook do Shopify
- Previne ataques de replay
- Garante autenticidade dos dados

### **Sanitização de Dados**
- Limpeza de caracteres de controle
- Escape de dados sensíveis
- Validação de tipos

### **Tratamento de Erros**
- Logs detalhados de erro
- Persistência de falhas
- Notificações de problemas

## 📈 **Monitoramento**

### **Logs Estruturados**
```
🔔 Webhook recebido
📦 Processamento de chargeback
✅ Sucesso / ❌ Erro
📊 Métricas de performance
```

### **Métricas Importantes**
- Taxa de sucesso de processamento
- Tempo de resposta
- Erros por tipo
- Uso de recursos

## 🆘 **Troubleshooting**

### **Problemas Comuns**

#### **Erro 401 - Shopify API**
```bash
# Verificar token de acesso
SHOPIFY_ACCESS_TOKEN=your_shopify_acess_token

# Verificar permissões do token
# Orders:read, Customers:read, write
```

#### **Erro de Conexão - Database**
```bash
# Verificar credenciais
DB_HOST=your-host
DB_PORT=your-port
DB_USER=your-user
DB_PASSWORD=your-password
```

#### **Erro de Notificação - Slack**
```bash
# Verificar token do bot
SLACK_BOT_TOKEN=xoxb-...

# Verificar permissões
# chat:write, channels:read
```

### **Logs de Debug**

```bash
# Habilitar logs detalhados
func start --verbose

# Ver logs em tempo real
func azure functionapp logstream your-function-name
```

## 🤝 **Contribuição**

### **Estrutura de Commits**
```
feat: nova funcionalidade
fix: correção de bug
docs: documentação
refactor: refatoração
```

### **Padrões de Código**
- TypeScript strict mode
- ESLint + Prettier
- Conventional Commits

## 📄 **Licença**

MIT License - veja [LICENSE](LICENSE) para detalhes.