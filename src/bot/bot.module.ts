import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';
import { PeopleModule } from '../people/people.module';
import { HolidaysModule } from '../holidays/holidays.module';

/**
 * Модуль Telegram бота
 * Отвечает за взаимодействие с Telegram API и обработку команд
 */
@Module({
  imports: [PeopleModule, HolidaysModule], // Импортируем модули для доступа к сервисам
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}
