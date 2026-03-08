#!/bin/bash

# Скрипт для деплоя Telegram Birthday Bot на сервер через OpenSSH
# Использование: ./deploy-ssh.sh [server_ip]

set -e

# Параметры
SERVER_IP=${1:-130.61.253.163}
PROJECT_NAME="telegram-birthday-bot"
REMOTE_DIR="/opt/$PROJECT_NAME"

echo "🚀 Начинаем деплой $PROJECT_NAME на сервер $SERVER_IP..."

# Проверяем SSH соединение
echo "🔍 Проверяем SSH соединение..."
ssh -o ConnectTimeout=10 root@$SERVER_IP "echo '✅ SSH соединение установлено'"

# Создаем директорию проекта на сервере
echo "📁 Создаем директорию проекта..."
ssh root@$SERVER_IP "sudo mkdir -p $REMOTE_DIR && sudo chown root:root $REMOTE_DIR"

# Копируем файлы проекта (используем tar через SSH)
echo "📦 Копируем файлы проекта..."
tar -czf - --exclude=node_modules --exclude=dist --exclude=.git --exclude=.idea --exclude=logs --exclude="*.key" . | ssh root@$SERVER_IP "tar -xzf - -C $REMOTE_DIR"

# Устанавливаем Docker на сервере если не установлен
echo "🐳 Проверяем Docker..."
ssh root@$SERVER_IP "
  if ! command -v docker &> /dev/null; then
    echo 'Устанавливаем Docker...'
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker root
  fi
"

# Устанавливаем Docker Compose на сервере если не установлен
echo "🔧 Проверяем Docker Compose..."
ssh root@$SERVER_IP "
  if ! command -v docker-compose &> /dev/null; then
    echo 'Устанавливаем Docker Compose...'
    sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
  fi
"

# Копируем .env.production в .env на сервере
echo "⚙️ Настраиваем переменные окружения..."
ssh root@$SERVER_IP "
  cd $REMOTE_DIR
  cp .env.production .env
  echo '✅ Файл .env создан из .env.production'
"

# Останавливаем старый контейнер если есть
echo "🛑 Останавливаем старый контейнер..."
ssh root@$SERVER_IP "
  cd $REMOTE_DIR
  docker-compose down || true
"

# Собираем и запускаем новый контейнер
echo "🔨 Собираем и запускаем новый контейнер..."
ssh root@$SERVER_IP "
  cd $REMOTE_DIR
  docker-compose build
  docker-compose up -d
"

# Проверяем статус
echo "🔍 Проверяем статус..."
ssh root@$SERVER_IP "
  cd $REMOTE_DIR
  docker-compose ps
  docker-compose logs --tail=20
"

echo "✅ Деплой завершен!"
echo "🌐 Бот доступен по API: http://$SERVER_IP:3000/bot/status"
echo "📱 Проверьте работу бота в Telegram командой /start"
