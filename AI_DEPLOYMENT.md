# 🚀 Развертывание AI функций

## 📋 Что готово

✅ **Все AI функции добавлены в проект:**
- Google Gemini интеграция
- Stable Diffusion генерация изображений
- Новые команды для тестирования
- Резервные механизмы

## 🔧 Шаги развертывания

### 1. Установка зависимостей
```bash
npm install
```
✅ Уже выполнено - AI пакеты установлены

### 2. Настройка API ключей

Создайте или обновите `.env.production`:

```bash
# Существующие настройки
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
ADMIN_USERNAMES=artem_smailik

# Добавьте AI API ключи
GOOGLE_GEMINI_API_KEY=your_google_gemini_key
HUGGINGFACE_API_KEY=your_huggingface_key
```

### 3. Сборка проекта
```bash
npm run build
```

### 4. Копирование на сервер
```bash
scp -i "ssh-key-2026-02-02.key" -r dist/ ubuntu@130.61.253.163:/opt/telegram-birthday-bot/
scp -i "ssh-key-2026-02-02.key" package.json ubuntu@130.61.253.163:/opt/telegram-birthday-bot/
scp -i "ssh-key-2026-02-02.key" .env.production ubuntu@130.61.253.163:/opt/telegram-birthday-bot/
```

### 5. Перезапуск на сервере
```bash
ssh -i "ssh-key-2026-02-02.key" ubuntu@130.61.253.163 "cd /opt/telegram-birthday-bot && npm install && sudo docker-compose restart"
```

## 🎯 Тестирование

### Проверка статуса AI:
```
/ai_status
```

### Тест AI генерации:
```
/ai_test
```

### Персональное поздравление:
```
/ai_birthday @username
```

### Праздничное поздравление:
```
/ai_holiday Новый год
```

## 🔑 Получение API ключей

### Google Gemini (бесплатно)
1. [AI Studio](https://makersuite.google.com/app/apikey)
2. "Create API Key"
3. Копируйте ключ

### Hugging Face (бесплатно)
1. [Hugging Face](https://huggingface.co/)
2. Settings → Access Tokens
3. "New token"
4. Копируйте токен

## 🎨 Возможности

### ✅ Если AI настроен:
- Уникальные изображения для каждого поздравления
- Персонализированные промпты
- Красивые тексты поздравлений
- Автоматическая генерация

### 🔄 Если AI недоступен:
- Простые цветные заглушки
- Готовые шаблоны поздравлений
- Полная функциональность сохраняется

## 📁 Новые файлы

```
src/
├── ai/
│   ├── ai.module.ts          # Модуль AI сервиса
│   └── ai.service.ts        # Google Gemini интеграция
├── image/
│   ├── image.module.ts        # Модуль изображений
│   └── image.service.ts      # Stable Diffusion интеграция
├── bot/
│   └── bot.service.ts       # Обновлен с AI командами
└── AI_FEATURES.md           # Документация
```

## 🚨 Важные замечания

1. **Canvas не требуется** - убран для простоты развертывания
2. **Резервные механизмы** - работают без AI
3. **Автоматическая очистка** - старые изображения удаляются
4. **Безопасность** - API ключи в переменных окружения

## 🎉 Готово к использованию!

После развертывания бот поддерживает:
- 🎂 Дни рождения с AI изображениями
- 🌸 8 марта с уникальными поздравлениями  
- 🎄 Любые праздники с генерацией
- 🔄 Полную резервную работу

**Наслаждайтесь AI поздравлениями!** 🎊
