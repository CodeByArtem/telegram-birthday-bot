import { Injectable, Logger } from '@nestjs/common';
import { Person } from '../people/people.service';

/**
 * Сервис для управления праздниками
 * Обрабатывает праздничные поздравления (8 марта и др.)
 */
@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name);

  /**
   * Получить всех женщин из списка
   */
  getWomen(people: Person[]): Person[] {
    return people.filter(person => 
      person.gender === 'female'
    );
  }

  /**
   * Проверить, сегодня 8 марта
   */
  isInternationalWomensDay(): boolean {
    const today = new Date();
    return today.getMonth() === 2 && today.getDate() === 8; // Март = 2 (0-indexed)
  }

  /**
   * Получить поздравление для 8 марта
   */
  getWomensDayMessage(person: Person): string {
    const mention = person.telegramUsername ? `@${person.telegramUsername}` : person.name;
    
    return `
🌸🌺🌷🌹🌸🌺🌷🌹
С 8 Марта, ${mention}! 🌷

🌟 Ты — настоящая женщина!
💫 Красивая, умная и сильная!
🌺 Желаю тебе счастья, любви 
   и гармонии во всём! 🌸

✨ Пусть каждый день будет 
   наполнен радостью и улыбками!
🌷 Будь любимой и желанной! 🌹

С праздником весны! 🌺🌸🌷
    `.trim();
  }

  /**
   * Получить изображения для 8 марта
   */
  getWomensDayImages(): string[] {
    return [
      'https://media.giphy.com/media/v1.i2pjlJ2BQ1hw/giphy.gif',
      'https://media.giphy.com/media/l4FGhGhS1NQh1s1qU/giphy.gif',
      'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
      'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif',
      'https://media.giphy.com/media/f3Jr9knTqQc2A/giphy.gif'
    ];
  }
}
