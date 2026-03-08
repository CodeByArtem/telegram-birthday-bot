import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Главная функция запуска приложения
 */
async function bootstrap() {
  // Создаем экземпляр NestJS приложения
  const app = await NestFactory.create(AppModule);

  // Запускаем приложение на порту 3000
  await app.listen(3000);
  
  console.log('🚀 Telegram Birthday Bot запущен на порту 3000');
}

bootstrap();
