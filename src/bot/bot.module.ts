import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';
import { PeopleModule } from '../people/people.module';

/**
 * Модуль Telegram бота
 * Отвечает за взаимодействие с Telegram API и обработку команд
 */
@Module({
  imports: [PeopleModule], // Импортируем модуль людей для доступа к сервису
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}
