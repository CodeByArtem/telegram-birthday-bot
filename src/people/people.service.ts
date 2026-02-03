import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// Подключаем плагин для парсинга кастомных форматов
dayjs.extend(customParseFormat);

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
      const birthDate = dayjs(person.birthDate, 'DD.MM.YYYY', true); // true = strict mode
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
      id: this.people.length > 0 ? Math.max(...this.people.map(p => p.id)) + 1 : 1,
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

    // Проверка валидности даты с strict mode
    const parsedDate = dayjs(birthDate, 'DD.MM.YYYY', true);
    if (!parsedDate.isValid()) {
      throw new Error('❌ Некорректная дата. Проверьте правильность даты.');
    }

    // Проверка что username указан
    if (!telegramUsername) {
      throw new Error('❌ Необходимо указать @username пользователя Telegram');
    }

    // Очищаем username от @
    const cleanUsername = telegramUsername.replace('@', '').trim();

    if (cleanUsername.length === 0) {
      throw new Error('❌ Username не может быть пустым');
    }

    // Проверка на дубликаты по username (без учета регистра)
    const exists = this.people.some(p =>
        p.telegramUsername?.toLowerCase() === cleanUsername.toLowerCase()
    );

    if (exists) {
      throw new Error(`❌ Пользователь @${cleanUsername} уже есть в списке дней рождения`);
    }

    // Примечание: Telegram сам проверит существование пользователя при упоминании
    // Если пользователя нет в чате, упоминание просто не будет кликабельным

    return this.addPerson({
      name,
      birthDate,
      telegramUsername: cleanUsername,
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
      const birthDate = dayjs(p.birthDate, 'DD.MM.YYYY', true);
      return birthDate.month() === dayjs().month();
    }).length;

    const nextMonth = this.people.filter(p => {
      const birthDate = dayjs(p.birthDate, 'DD.MM.YYYY', true);
      return birthDate.month() === dayjs().add(1, 'month').month();
    }).length;

    // Статистика по месяцам
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      count: this.people.filter(p => {
        const birthDate = dayjs(p.birthDate, 'DD.MM.YYYY', true);
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
    const birthDate = dayjs(person.birthDate, 'DD.MM.YYYY', true);
    const today = dayjs();
    return today.diff(birthDate, 'year');
  }
}