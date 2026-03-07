import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BotModule } from './bot/bot.module';
import { PeopleModule } from './people/people.module';
import { HolidaysModule } from './holidays/holidays.module';

/**
 * Корневой модуль приложения
 * Подключает все необходимые модули и конфигурацию
 */
@Module({
  imports: [
    // Модуль для работы с переменными окружения (.env файлы)
    ConfigModule.forRoot({
      isGlobal: true, // Делаем ConfigModule доступным во всем приложении
    }),
    
    // Модуль для работы с cron задачами
    ScheduleModule.forRoot(),
    
    // Модуль Telegram бота
    BotModule,
    
    // Модуль управления людьми
    PeopleModule,
    
    // Модуль управления праздниками
    HolidaysModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
