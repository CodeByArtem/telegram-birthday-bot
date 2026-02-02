import { Module } from '@nestjs/common';
import { PeopleService } from './people.service';

/**
 * Модуль управления людьми
 * Отвечает за хранение и управление списком людей с днями рождения
 */
@Module({
  providers: [PeopleService],
  exports: [PeopleService], // Экспортируем сервис для использования в других модулях
})
export class PeopleModule {}
