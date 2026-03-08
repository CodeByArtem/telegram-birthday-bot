#!/bin/bash

# Скрипт для деплоя Telegram Birthday Bot на сервер
# Использование: ./deploy.sh [server_user] [server_ip]

set -e

# Параметры
SERVER_USER=${1:-root}
SERVER_IP=${2:-YOUR_SERVER_IP}
PROJECT_NAME="telegram-birthday-bot"
REMOTE_DIR="/opt/$PROJECT_NAME"

echo "🚀 Начинаем деплой $PROJECT_NAME на сервер $SERVER_IP..."

# Проверяем SSH соединение
echo "🔍 Проверяем SSH соединение..."
ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP "echo '✅ SSH соединение установлено'"

# Создаем директорию проекта на сервере
echo "📁 Создаем директорию проекта..."
ssh $SERVER_USER@$SERVER_IP "sudo mkdir -p $REMOTE_DIR && sudo chown $SERVER_USER:$SERVER_USER $REMOTE_DIR"

# Копируем файлы проекта
echo "📦 Копируем файлы проекта..."
rsync -avz --progress \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude .idea \
  --exclude logs \
  --exclude '*.key' \
  . $SERVER_USER@$SERVER_IP:$REMOTE_DIR/

# Устанавливаем Docker на сервере если не установлен
echo "🐳 Проверяем Docker..."
ssh $SERVER_USER@$SERVER_IP "
  if ! command -v docker &> /dev/null; then
    echo 'Устанавливаем Docker...'
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker \$USER
  fi
"

# Устанавливаем Docker Compose на сервере если не установлен
echo "🔧 Проверяем Docker Compose..."
ssh $SERVER_USER@$SERVER_IP "
  if ! command -v docker-compose &> /dev/null; then
    echo 'Устанавливаем Docker Compose...'
    sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
  fi
"

# Создаем файл окружения на сервере
echo "⚙️ Настраиваем переменные окружения..."
echo "⚠️  Не забудьте отредактировать $REMOTE_DIR/.env на сервере!"

# Останавливаем старый контейнер если есть
echo "🛑 Останавливаем старый контейнер..."
ssh $SERVER_USER@$SERVER_IP "
  cd $REMOTE_DIR
  docker-compose down || true
"

# Собираем и запускаем новый контейнер
echo "🔨 Собираем и запускаем новый контейнер..."
ssh $SERVER_USER@$SERVER_IP "
  cd $REMOTE_DIR
  docker-compose build
  docker-compose up -d
"

# Проверяем статус
echo "🔍 Проверяем статус..."
ssh $SERVER_USER@$SERVER_IP "
  cd $REMOTE_DIR
  docker-compose ps
  docker-compose logs --tail=20
"

echo "✅ Деплой завершен!"
echo "📝 Не забудьте:"
echo "   1. Отредактировать $REMOTE_DIR/.env на сервере"
echo "   2. Проверить работу бота в Telegram"
echo "   3. Настроить автоматический перезапуск при перезагрузке сервера"
