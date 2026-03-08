#!/bin/bash

# Автоматический деплой с настройкой .env на сервере
# Использование: ./deploy-production.sh

set -e

# Параметры сервера (замените на ваши)
SERVER_USER="ubuntu"
SERVER_IP="130.61.253.163"
SSH_KEY="ssh-key-2026-02-02.key"
PROJECT_NAME="telegram-birthday-bot"
REMOTE_DIR="/opt/$PROJECT_NAME"

echo "🚀 Деплой AI Birthday Bot на сервер $SERVER_IP..."

# 1. Сборка проекта
echo "📦 Собираем проект..."
npm run build

# 2. Копирование файлов на сервер
echo "📤 Копируем файлы на сервер..."
scp -i "$SSH_KEY" -r dist/ $SERVER_USER@$SERVER_IP:$REMOTE_DIR/
scp -i "$SSH_KEY" package.json $SERVER_USER@$SERVER_IP:$REMOTE_DIR/
scp -i "$SSH_KEY" .env.example $SERVER_USER@$SERVER_IP:$REMOTE_DIR/.env

# 3. Установка зависимостей
echo "📦 Устанавливаем зависимости..."
ssh -i "$SSH_KEY" $SERVER_USER@$SERVER_IP "cd $REMOTE_DIR && npm ci --production"

# 4. Настройка .env файла
echo "⚙️ Настраиваем переменные окружения..."
ssh -i "$SSH_KEY" $SERVER_USER@$SERVER_IP << EOF
cd $REMOTE_DIR

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "❌ .env файл не найден!"
    echo "📝 Пожалуйста, добавьте следующие переменные в .env:"
    echo "TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN"
    echo "TELEGRAM_CHAT_ID=YOUR_CHAT_ID"
    echo "ADMIN_USERNAMES=admin1,admin2"
    echo "GOOGLE_GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY"
    echo "REPLICATE_API_TOKEN=YOUR_REPLICATE_API_TOKEN"
    echo "PORT=3000"
    echo "NODE_ENV=production"
    exit 1
fi

echo "✅ .env файл найден"
EOF

# 5. Перезапуск Docker контейнера
echo "🐳 Перезапускаем Docker..."
ssh -i "$SSH_KEY" $SERVER_USER@$SERVER_IP "cd $REMOTE_DIR && sudo docker-compose down && sudo docker-compose up -d"

# 6. Проверка статуса
echo "🔍 Проверяем статус..."
sleep 5
ssh -i "$SSH_KEY" $SERVER_USER@$SERVER_IP "cd $REMOTE_DIR && sudo docker-compose logs --tail=20"

echo "✅ Деплой завершен!"
echo "🔧 Проверьте логи выше и убедитесь что бот запущен"
echo "📱 Протестируйте команды в Telegram: /ai_status, /start"
