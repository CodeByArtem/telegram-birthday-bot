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
    {
      id: 1,
      name: 'Иван Петров',
      birthDate: '15.06.1990',
      telegramUsername: 'ivan_petrov',
    },
    {
      id: 2,
      name: 'Мария Сидорова',
      birthDate: '15.06.1985',
    },
    {
      id: 3,
      name: 'Алексей Иванов',
      birthDate: '16.06.1992',
      telegramUsername: 'alex_ivanov',
    },
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
   * Получить возраст человека
   */
  getPersonAge(person: Person): number {
    const birthDate = dayjs(person.birthDate, 'DD.MM.YYYY');
    const today = dayjs();
    return today.diff(birthDate, 'year');
  }
}
