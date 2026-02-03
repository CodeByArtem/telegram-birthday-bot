import { Injectable } from '@nestjs/common';
import * as dayjs from 'dayjs';

/**
 * Интерфейс человека с информацией о дне рождения
 */
export interface Person {
  id: number;
  name: string;
  birthDate: string; // Формат: DD.MM.YYYY
  telegramUsername?: string; // Опционально, для упоминания в Telegram
}

/**
 * Сервис для управления списком людей
 * Хранит людей в массиве (в будущем можно заменить на базу данных)
 */
@Injectable()
export class PeopleService {
  // Массив людей с днями рождения
  private readonly people: Person[] = [
    // Добавляйте людей сюда через команду /add в Telegram
    // Формат: /add ДД.ММ.ГГГГ @username
  ];

  /**
   * Получить всех людей
   */
  getAllPeople(): Person[] {
    return this.people;
  }

  /**
   * Получить человека по ID
   */
  getPersonById(id: number): Person | undefined {
    return this.people.find(person => person.id === id);
  }

  /**
   * Получить людей, у которых сегодня день рождения
   */
  getPeopleWithBirthdayToday(): Person[] {
    const today = dayjs();
    
    return this.people.filter(person => {
      const birthDate = dayjs(person.birthDate, 'DD.MM.YYYY');
      // Сравниваем только день и месяц
      return birthDate.date() === today.date() && 
             birthDate.month() === today.month();
    });
  }

  /**
   * Добавить нового человека
   */
  addPerson(person: Omit<Person, 'id'>): Person {
    const newPerson: Person = {
      ...person,
      id: Math.max(...this.people.map(p => p.id)) + 1,
    };
    
    this.people.push(newPerson);
    return newPerson;
  }

  /**
   * Удалить человека по ID
   */
  removePerson(id: number): boolean {
    const index = this.people.findIndex(person => person.id === id);
    if (index !== -1) {
      this.people.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Проверить, является ли пользователь участником чата
   */
  async validateChatMember(bot: any, chatId: string, username?: string): Promise<boolean> {
    if (!username) return false;
    
    try {
      const chatMember = await bot.getChatMember(chatId, username);
      return ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) {
      return false;
    }
  }

  /**
   * Добавить нового человека из Telegram команды с проверкой
   */
  async addPersonFromTelegramWithValidation(
    name: string, 
    birthDate: string, 
    telegramUsername?: string,
    bot?: any,
    chatId?: string
  ): Promise<Person> {
    // Проверка формата даты
    const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!dateRegex.test(birthDate)) {
      throw new Error('❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ');
    }

    // Проверка на дубликаты
    const exists = this.people.some(p => 
      p.name.toLowerCase() === name.toLowerCase()
    );
    
    if (exists) {
      throw new Error('❌ Человек с таким именем уже существует');
    }

    // Если указан username, проверяем что он в чате
    if (telegramUsername && bot && chatId) {
      const cleanUsername = telegramUsername.replace('@', '');
      const isValidMember = await this.validateChatMember(bot, chatId, cleanUsername);
      
      if (!isValidMember) {
        throw new Error(`❌ Пользователь @${cleanUsername} не найден в чате`);
      }
    }

    return this.addPerson({
      name,
      birthDate,
      telegramUsername: telegramUsername?.replace('@', ''),
    });
  }

  /**
   * Удалить человека по имени
   */
  removePersonByName(name: string): boolean {
    const person = this.people.find(p => 
      p.name.toLowerCase() === name.toLowerCase()
    );
    
    if (!person) {
      throw new Error('❌ Человек не найден');
    }
    
    return this.removePerson(person.id);
  }

  /**
   * Найти людей по имени (для поиска)
   */
  findPeopleByName(searchTerm: string): Person[] {
    return this.people.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  /**
   * Получить статистику по дням рождения
   */
  getBirthdayStats() {
    const total = this.people.length;
    const thisMonth = this.people.filter(p => {
      const birthDate = dayjs(p.birthDate, 'DD.MM.YYYY');
      return birthDate.month() === dayjs().month();
    }).length;
    
    const nextMonth = this.people.filter(p => {
      const birthDate = dayjs(p.birthDate, 'DD.MM.YYYY');
      return birthDate.month() === dayjs().add(1, 'month').month();
    }).length;

    // Статистика по месяцам
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      count: this.people.filter(p => {
        const birthDate = dayjs(p.birthDate, 'DD.MM.YYYY');
        return birthDate.month() === i;
      }).length
    }));

    return {
      total,
      thisMonth,
      nextMonth,
      monthlyStats,
      averagePerMonth: (total / 12).toFixed(1)
    };
  }

  /**
   * Получить возраст человека
   */
  getPersonAge(person: Person): number {
    const birthDate = dayjs(person.birthDate, 'DD.MM.YYYY');
    const today = dayjs();
    return today.diff(birthDate, 'year');
  }
}
