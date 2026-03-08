# 🚀 Деплой Telegram Birthday Bot

## 📋 Инструкция по развертыванию на сервере

### 1. Подготовка сервера

**Требования:**
- Ubuntu 20.04+ / CentOS 8+ / Debian 10+
- SSH доступ
- Минимум 512MB RAM, 10GB диска

**Установка Docker (если не установлен):**
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Перезайти в систему или выполнить:
newgrp docker
```

### 2. Настройка переменных окружения

Скопируйте и отредактируйте файл окружения на сервере:
```bash
cp .env.production .env
nano .env
```

**Обязательные переменные:**
```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890
ADMIN_USERNAMES=admin1,admin2,your_username
PORT=3000
NODE_ENV=production
```

### 3. Деплой

**Способ 1: Автоматический (рекомендуется)**

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh root YOUR_SERVER_IP
```

**Windows:**
```cmd
deploy.bat root YOUR_SERVER_IP
```

**Способ 2: Ручной**

```bash
# 1. Копируем файлы на сервер
rsync -avz --exclude node_modules --exclude dist . root@YOUR_SERVER_IP:/opt/telegram-birthday-bot/

# 2. Подключаемся к серверу
ssh root@YOUR_SERVER_IP
cd /opt/telegram-birthday-bot

# 3. Настраиваем .env файл
cp .env.production .env
nano .env

# 4. Собираем и запускаем
docker-compose build
docker-compose up -d
```

### 4. Проверка работы

```bash
# Проверить статус контейнера
docker-compose ps

# Посмотреть логи
docker-compose logs -f

# Проверить API
curl http://localhost:3000/bot/status
```

### 5. Автоматический запуск при перезагрузке

**Создать сервис systemd:**
```bash
sudo nano /etc/systemd/system/telegram-bot.service
```

```ini
[Unit]
Description=Telegram Birthday Bot
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/telegram-birthday-bot
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Включаем автозапуск
sudo systemctl enable telegram-bot.service
sudo systemctl start telegram-bot.service
```

### 6. Мониторинг

**Проверка здоровья:**
```bash
# Статус контейнера
docker-compose ps

# Логи в реальном времени
docker-compose logs -f telegram-bot

# Перезапуск
docker-compose restart
```

**API эндпоинты:**
- `GET /bot/status` - статус бота
- `GET /bot/info` - информация о боте
- `POST /bot/send` - отправить тестовое сообщение

## 🔧 SSH Ключи

Для деплоя используются SSH ключи:
- Приватный: `ssh-key-2026-02-02.key`
- Публичный: `ssh-key-2026-02-02.key.pub`

**Добавить публичный ключ на сервер:**
```bash
cat ssh-key-2026-02-02.key.pub | ssh root@YOUR_SERVER_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

## 🐛 Troubleshooting

**Проблема:** Бот не отвечает
```bash
# Проверить логи
docker-compose logs telegram-bot

# Проверить переменные окружения
docker-compose exec telegram-bot env | grep TELEGRAM
```

**Проблема:** Контейнер не запускается
```bash
# Пересобрать образ
docker-compose build --no-cache

# Проверить порты
netstat -tlnp | grep 3000
```

**Проблема:** Нет доступа к API
```bash
# Проверить firewall
sudo ufw status
sudo ufw allow 3000
```

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs -f`
2. Убедитесь что `.env` файл заполнен правильно
3. Проверьте доступность Telegram API
4. Проверьте права доступа к файлам
