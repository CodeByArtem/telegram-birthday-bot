# 🚀 Инструкция по настройке сервера

## 📋 Что нужно сделать на сервере:

### 1. Подключитесь к серверу:
```bash
ssh -i "ssh-key-2026-02-02.key" ubuntu@130.61.253.163
```

### 2. Перейдите в папку проекта:
```bash
cd /opt/telegram-birthday-bot
```

### 3. Проверьте .env файл:
```bash
cat .env
```

### 4. Если .env пустой, добавьте переменные:
```bash
nano .env
```

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=ВАШ_ТЕЛЕГРАМ_ТОКЕН
TELEGRAM_CHAT_ID=ВАШ_CHAT_ID

# Admin Configuration
ADMIN_USERNAMES=admin1,admin2,ваш_username

# AI Services Configuration
GOOGLE_GEMINI_API_KEY=ВАШ_GOOGLE_GEMINI_API_KEY
REPLICATE_API_TOKEN=ВАШ_REPLICATE_API_TOKEN

# Application Configuration
PORT=3000
NODE_ENV=production
```

### 5. Перезапустите бота:
```bash
sudo docker-compose restart
```

### 6. Проверьте логи:
```bash
sudo docker-compose logs -f
```

### 7. Проверьте статус AI сервисов:
Отправьте в Telegram боту команду:
```
/ai_status
```

## 🔧 Если что-то не работает:

### Проверьте порты:
```bash
sudo netstat -tlnp | grep 3000
```

### Проверьте Docker:
```bash
sudo docker ps
sudo docker-compose ps
```

### Перезапустите всё:
```bash
sudo docker-compose down
sudo docker-compose up -d
```

## ✅ Готово!

После настройки .env файл бот будет:
- Автоматически поздравлять с днями рождения в 11:00
- Поздравлять с 8 марта в 18:00
- Генерировать AI поздравления
- Создавать изображения

**Наслаждайтесь AI ботом!** 🎉
