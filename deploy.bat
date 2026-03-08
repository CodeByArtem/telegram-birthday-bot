@echo off
REM Скрипт для деплоя Telegram Birthday Bot на Windows сервер
REM Использование: deploy.bat [server_user] [server_ip]

setlocal enabledelayedexpansion

REM Параметры
set SERVER_USER=%1
set SERVER_IP=%2
if "%SERVER_USER%"=="" set SERVER_USER=root
if "%SERVER_IP%"=="" set SERVER_IP=YOUR_SERVER_IP

set PROJECT_NAME=telegram-birthday-bot
set REMOTE_DIR=/opt/%PROJECT_NAME%

echo 🚀 Начинаем деплой %PROJECT_NAME% на сервер %SERVER_IP%...

REM Проверяем plink (PuTTY)
echo 🔍 Проверяем plink...
where plink >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ plink не найден! Установите PuTTY или добавьте в PATH
    echo Скачать: https://www.putty.org/
    exit /b 1
)

REM Проверяем pscp (PuTTY)
echo 🔍 Проверяем pscp...
where pscp >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ pscp не найден! Установите PuTTY или добавьте в PATH
    echo Скачать: https://www.putty.org/
    exit /b 1
)

REM Проверяем SSH соединение
echo 🔍 Проверяем SSH соединение...
plink -ssh %SERVER_USER%@%SERVER_IP% -batch "echo '✅ SSH соединение установлено'"

REM Создаем директорию проекта на сервере
echo 📁 Создаем директорию проекта...
plink -ssh %SERVER_USER%@%SERVER_IP% -batch "sudo mkdir -p %REMOTE_DIR% && sudo chown %SERVER_USER%:%SERVER_USER% %REMOTE_DIR%"

REM Копируем файлы проекта
echo 📦 Копируем файлы проекта...
pscp -r -exclude node_modules -exclude dist -exclude .git -exclude .idea -exclude logs -exclude "*.key" . %SERVER_USER%@%SERVER_IP%:%REMOTE_DIR%/

REM Устанавливаем Docker на сервере если не установлен
echo 🐳 Проверяем Docker...
plink -ssh %SERVER_USER%@%SERVER_IP% -batch "
  if ! command -v docker ^&^> /dev/null; then
    echo 'Устанавливаем Docker...'
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker \$USER
  fi
"

REM Устанавливаем Docker Compose на сервере если не установлен
echo 🔧 Проверяем Docker Compose...
plink -ssh %SERVER_USER%@%SERVER_IP% -batch "
  if ! command -v docker-compose ^&^> /dev/null; then
    echo 'Устанавливаем Docker Compose...'
    sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
  fi
"

REM Останавливаем старый контейнер если есть
echo 🛑 Останавливаем старый контейнер...
plink -ssh %SERVER_USER%@%SERVER_IP% -batch "
  cd %REMOTE_DIR%
  docker-compose down ^|^| true
"

REM Собираем и запускаем новый контейнер
echo 🔨 Собираем и запускаем новый контейнер...
plink -ssh %SERVER_USER%@%SERVER_IP% -batch "
  cd %REMOTE_DIR%
  docker-compose build
  docker-compose up -d
"

REM Проверяем статус
echo 🔍 Проверяем статус...
plink -ssh %SERVER_USER%@%SERVER_IP% -batch "
  cd %REMOTE_DIR%
  docker-compose ps
  docker-compose logs --tail=20
"

echo ✅ Деплой завершен!
echo 📝 Не забудьте:
echo    1. Отредактировать %REMOTE_DIR%/.env на сервере
echo    2. Проверить работу бота в Telegram
echo    3. Настроить автоматический перезапуск при перезагрузке сервера

pause
