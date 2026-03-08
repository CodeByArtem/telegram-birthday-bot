# 🤖 Telegram Birthday Bot с AI функциями

## 🎯 Обзор

Бот теперь поддерживает генерацию уникальных поздравлений с помощью искусственного интеллекта:

- **🧠 Google Gemini** - генерация промптов и текстов
- **🎨 Stable Diffusion** - генерация изображений
- **🔄 Резервные механизмы** - работа без AI

## 🚀 Быстрый старт

### 1. API ключи (бесплатно)

```bash
# Google Gemini
# https://makersuite.google.com/app/apikey
GOOGLE_GEMINI_API_KEY=your_key

# Hugging Face  
# https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY=your_token
```

### 2. Сборка и развертывание

```bash
npm run build

# Копировать на сервер
scp -i "ssh-key-2026-02-02.key" -r dist/ ubuntu@130.61.253.163:/opt/telegram-birthday-bot/

# Перезапуск
ssh -i "ssh-key-2026-02-02.key" ubuntu@130.61.253.163 "cd /opt/telegram-birthday-bot && sudo docker-compose restart"
```

## 🎮 Новые команды

| Команда | Описание | Пример |
|---------|-----------|---------|
| `/ai_status` | Проверить статус AI сервисов | `/ai_status` |
| `/ai_test` | Тестировать AI генерацию | `/ai_test` |
| `/ai_birthday @username` | Персональное поздравление | `/ai_birthday @ann` |
| `/ai_holiday [название]` | Любой праздник | `/ai_holiday Новый год` |

## 🎨 Как работает

### 1. Генерация промпта
```
🧠 Google Gemini → "beautiful spring flowers, International Women's Day..."
```

### 2. Генерация изображения  
```
🎨 Stable Diffusion → Уникальное изображение 512x512px
```

### 3. Генерация текста
```
📝 AI текст → "🌸 С 8 марта, дорогая Анна! Желаю..."
```

### 4. Отправка в Telegram
```
📤 Изображение + текст → Пользователь получает поздравление
```

## 🔄 Резервные механизмы

Если AI недоступен:
- **Изображения**: Простые цветные заглушки
- **Тексты**: Готовые шаблоны поздравлений  
- **Функциональность**: Полностью сохраняется

## 📁 Структура проекта

```
src/
├── ai/
│   ├── ai.module.ts          # Google Gemini
│   └── ai.service.ts        # Генерация промптов/текстов
├── image/
│   ├── image.module.ts        # Модуль изображений
│   └── image.service.ts      # Stable Diffusion + заглушки
├── bot/
│   └── bot.service.ts       # AI команды + логика
└── people/
    └── people.service.ts     # + getPersonByUsername()
```

## 🎉 Готово к использованию!

После развертывания бот поддерживает:
- ✅ Дни рождения с AI изображениями
- ✅ 8 марта с уникальными поздравлениями
- ✅ Любые праздники с генерацией
- ✅ Полную работу без AI

**Наслаждайтесь AI поздравлениями!** 🎊
