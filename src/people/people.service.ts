import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as customParseFormat from 'dayjs/plugin/customParseFormat';
import * as fs from 'fs';
import * as path from 'path';

// Подключаем плагин для парсинга кастомных форматов
dayjs.extend(customParseFormat);

/**
 * Интерфейс человека с информацией о дне рождения
 */
export interface Person {
  id: number;
  name: string;
  birthDate: string; // Формат: DD.MM.YYYY
  gender?: 'male' | 'female'; // Пол: male/female (опционально)
  telegramUsername?: string; // Опционально, для упоминания в Telegram
}

/**
 * Сервис для управления списком людей
 * Хранит людей в JSON файле для сохранения между перезапусками
 */
@Injectable()
export class PeopleService implements OnModuleInit {
  private readonly logger = new Logger(PeopleService.name);
  private people: Person[] = [];
  private readonly dataFilePath = path.join(process.cwd(), 'data', 'birthdays.json');

  /**
   * Инициализация при запуске - загружаем данные из файла
   */
  async onModuleInit() {
    await this.loadDataFromFile();
    this.logger.log(`✅ Загружено ${this.people.length} записей из файла`);
  }

  /**
   * Загрузить данные из JSON файла
   */
  private async loadDataFromFile(): Promise<void> {
    try {
      // Создаём папку data если её нет
      const dataDir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        this.logger.log('📁 Создана папка data/');
      }

      // Проверяем существование файла
      if (fs.existsSync(this.dataFilePath)) {
        const fileContent = fs.readFileSync(this.dataFilePath, 'utf-8');
        this.people = JSON.parse(fileContent);
        this.logger.log(`📂 Данные загружены из ${this.dataFilePath}`);
      } else {
        // Создаём пустой файл
        this.people = [];
        await this.saveDataToFile();
        this.logger.log(`📝 Создан новый файл ${this.dataFilePath}`);
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка загрузки данных: ${error.message}`);
      this.people = [];
    }
  }

  /**
   * Сохранить данные в JSON файл
   */
  private async saveDataToFile(): Promise<void> {
    try {
      const dataDir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(
          this.dataFilePath,
          JSON.stringify(this.people, null, 2),
          'utf-8'
      );
      this.logger.log(`💾 Данные сохранены в ${this.dataFilePath}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка сохранения данных: ${error.message}`);
    }
  }

  /**
   * Публичный метод для сохранения данных (используется в BotService)
   */
  async saveData(): Promise<void> {
    await this.saveDataToFile();
  }

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
      const birthDate = dayjs(person.birthDate, 'DD.MM.YYYY', true);
      // Сравниваем только день и месяц
      return birthDate.date() === today.date() &&
          birthDate.month() === today.month();
    });
  }

  /**
   * Добавить нового человека
   */
  async addPerson(person: Omit<Person, 'id'>): Promise<Person> {
    const newPerson: Person = {
      ...person,
      id: this.people.length > 0 ? Math.max(...this.people.map(p => p.id)) + 1 : 1,
    };

    this.people.push(newPerson);
    await this.saveDataToFile(); // ✅ Сохраняем в файл
    return newPerson;
  }

  /**
   * Удалить человека по ID
   */
  async removePerson(id: number): Promise<boolean> {
    const index = this.people.findIndex(person => person.id === id);
    if (index !== -1) {
      this.people.splice(index, 1);
      await this.saveDataToFile(); // ✅ Сохраняем в файл
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

    return await this.addPerson({
      name,
      birthDate,
      telegramUsername: cleanUsername,
    });
  }

  /**
   * Удалить человека по имени
   */
  async removePersonByName(name: string): Promise<boolean> {
    const person = this.people.find(p =>
        p.name.toLowerCase() === name.toLowerCase()
    );

    if (!person) {
      throw new Error('❌ Человек не найден');
    }

    return await this.removePerson(person.id);
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

  /**
   * Получить всех женщин из списка
   */
  getWomen(): Person[] {
    return this.people.filter(person => person.gender === 'female');
  }

  /**
   * Получить человека по username
   */
  getPersonByUsername(username: string): Person | undefined {
    return this.people.find(person => 
      person.telegramUsername?.toLowerCase() === username.toLowerCase()
    );
  }
}