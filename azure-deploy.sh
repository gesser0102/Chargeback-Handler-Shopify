#!/bin/bash

# Script de deploy para Azure Functions com pnpm

echo "🚀 Iniciando deploy para Azure Functions..."

# Limpar cache e builds anteriores
echo "🧹 Limpando cache..."
rm -rf dist/
rm -rf node_modules/
rm -f pnpm-lock.yaml

# Instalar pnpm globalmente
echo "📦 Instalando pnpm..."
npm install -g pnpm@latest

# Instalar dependências
echo "📦 Instalando dependências..."
pnpm install --frozen-lockfile

# Build do projeto
echo "🔨 Fazendo build..."
pnpm run build

# Verificar se o build foi bem-sucedido
if [ ! -d "dist" ]; then
    echo "❌ Erro: Build falhou - pasta dist não encontrada"
    exit 1
fi

# Deploy para Azure com configurações específicas
echo "☁️ Fazendo deploy para Azure..."
func azure functionapp publish dgftribe \
    --build remote \
    --force \
    --clean

echo "✅ Deploy concluído!" 