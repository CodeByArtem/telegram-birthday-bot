# Скрипт деплоя Telegram Birthday Bot через PowerShell SSH
# Использование: .\deploy.ps1 [server_ip]

param(
    [string]$SERVER_IP = "130.61.253.163"
)

$PROJECT_NAME = "telegram-birthday-bot"
$REMOTE_DIR = "/opt/$PROJECT_NAME"

Write-Host "🚀 Начинаем деплой $PROJECT_NAME на сервер $SERVER_IP..." -ForegroundColor Green

# Проверяем SSH соединение
Write-Host "🔍 Проверяем SSH соединение..." -ForegroundColor Yellow
try {
    $result = ssh -o ConnectTimeout=10 root@$SERVER_IP "echo '✅ SSH соединение установлено'"
    Write-Host $result -ForegroundColor Green
} catch {
    Write-Host "❌ Не удалось подключиться к серверу" -ForegroundColor Red
    Write-Host "Убедитесь что:" -ForegroundColor Yellow
    Write-Host "1. Сервер доступен по IP $SERVER_IP" -ForegroundColor Yellow
    Write-Host "2. SSH ключ настроен правильно" -ForegroundColor Yellow
    Write-Host "3. Порт 22 открыт" -ForegroundColor Yellow
    exit 1
}

# Создаем директорию проекта на сервере
Write-Host "📁 Создаем директорию проекта..." -ForegroundColor Yellow
ssh root@$SERVER_IP "sudo mkdir -p $REMOTE_DIR && sudo chown root:root $REMOTE_DIR"

# Копируем файлы проекта
Write-Host "📦 Копируем файлы проекта..." -ForegroundColor Yellow
# Используем tar для копирования
$filesToExclude = @("node_modules", "dist", ".git", ".idea", "logs", "*.key")
$excludeArgs = $filesToExclude | ForEach-Object { "--exclude=$_" }
$tarCommand = "tar -czf - $excludeArgs ."
ssh root@$SERVER_IP "mkdir -p $REMOTE_DIR" 2>$null
Invoke-Expression "$tarCommand" | ssh root@$SERVER_IP "tar -xzf - -C $REMOTE_DIR"

# Устанавливаем Docker если нужно
Write-Host "🐳 Проверяем Docker..." -ForegroundColor Yellow
ssh root@$SERVER_IP "
if ! command -v docker &> /dev/null; then
    echo 'Устанавливаем Docker...'
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker root
    systemctl enable docker
    systemctl start docker
fi
"

# Устанавливаем Docker Compose если нужно
Write-Host "🔧 Проверяем Docker Compose..." -ForegroundColor Yellow
ssh root@$SERVER_IP "
if ! command -v docker-compose &> /dev/null; then
    echo 'Устанавливаем Docker Compose...'
    sudo curl -L 'https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)' -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi
"

# Настраиваем переменные окружения
Write-Host "⚙️ Настраиваем переменные окружения..." -ForegroundColor Yellow
ssh root@$SERVER_IP "
cd $REMOTE_DIR
cp .env.production .env
echo '✅ Файл .env создан из .env.production'
"

# Останавливаем старый контейнер
Write-Host "🛑 Останавливаем старый контейнер..." -ForegroundColor Yellow
ssh root@$SERVER_IP "cd $REMOTE_DIR && docker-compose down" 2>$null

# Собираем и запускаем новый контейнер
Write-Host "🔨 Собираем и запускаем новый контейнер..." -ForegroundColor Yellow
ssh root@$SERVER_IP "
cd $REMOTE_DIR
docker-compose build
docker-compose up -d
"

# Проверяем статус
Write-Host "🔍 Проверяем статус..." -ForegroundColor Yellow
ssh root@$SERVER_IP "
cd $REMOTE_DIR
echo '=== Статус контейнеров ==='
docker-compose ps
echo ''
echo '=== Последние логи ==='
docker-compose logs --tail=20
"

Write-Host "✅ Деплой завершен!" -ForegroundColor Green
Write-Host "🌐 API доступен: http://$SERVER_IP:3000/bot/status" -ForegroundColor Cyan
Write-Host "📱 Проверьте бота в Telegram командой /start" -ForegroundColor Cyan
Write-Host "📊 Логи в реальном времени: ssh root@$SERVER_IP 'cd $REMOTE_DIR && docker-compose logs -f'" -ForegroundColor Gray
