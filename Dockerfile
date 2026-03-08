# Используем Node.js 18 Alpine для меньшего размера образа
FROM node:18-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем все зависимости (включая dev зависимости для сборки)
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем проект
RUN npm run build

# Финальный образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Копируем package файлы и устанавливаем production зависимости
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Копируем собранный проект
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

# Меняем владельца файлов
RUN chown -R nodejs:nodejs /app

# Переключаемся на пользователя nodejs
USER nodejs

# Открываем порт
EXPOSE 3000

# Команда запуска
CMD ["node", "dist/index.js"]
