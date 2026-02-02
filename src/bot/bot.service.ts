import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
const TelegramBot = require('node-telegram-bot-api');
import { PeopleService, Person } from '../people/people.service';

/**
 * Тип для Telegram бота
 */
type TelegramBotInstance = InstanceType<typeof TelegramBot>;

/**
 * Сервис Telegram бота
 * Отвечает за отправку сообщений и обработку команд
 */
@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private bot: any;
  private chatId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly peopleService: PeopleService,
  ) {}

  /**
   * Инициализация бота при запуске модуля
   */
  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');

    if (!token) {
      this.logger.error('❌ TELEGRAM_BOT_TOKEN не найден в переменных окружения');
      throw new Error('TELEGRAM_BOT_TOKEN обязателен');
    }

    if (!this.chatId) {
      this.logger.error('❌ TELEGRAM_CHAT_ID не найден в переменных окружения');
      throw new Error('TELEGRAM_CHAT_ID обязателен');
    }

    // Создаем экземпляр бота
    this.bot = new TelegramBot(token, { polling: true });

    // Настраиваем обработчики команд
    this.setupHandlers();

    this.logger.log('✅ Telegram бот успешно инициализирован');
  }

  /**
   * Настройка обработчиков команд бота
   */
  private setupHandlers() {
    // Обработчик команды /start
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcomeMessage = `
🎉 Добро пожаловать в Telegram Birthday Bot!

Я помогу тебе не забывать о днях рождения!

📋 Доступные команды:
/start - Показать это сообщение
/help - Помощь
/birthdays - Показать список всех дней рождения
/today - Показать сегодняшние именинники

🕐 Каждый день в 11:00 я проверяю список и поздравляю именинников!
      `.trim();

      this.bot.sendMessage(chatId, welcomeMessage);
    });

    // Обработчик команды /help
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const helpMessage = `
📖 Справка по командам:

/start - Приветственное сообщение
/help - Эта справка
/birthdays - Полный список дней рождения
/today - Сегодняшние именинники

⏰ Автоматические поздравления:
Каждый день в 11:00 я проверяю список и отправляю поздравления.

🔧 Для администратора:
Чтобы добавить или удалить человека, отредактируйте массив в файле people.service.ts
      `.trim();

      this.bot.sendMessage(chatId, helpMessage);
    });

    // Обработчик команды /birthdays
    this.bot.onText(/\/birthdays/, (msg) => {
      const chatId = msg.chat.id;
      const people = this.peopleService.getAllPeople();
      
      if (people.length === 0) {
        this.bot.sendMessage(chatId, '📭 Список дней рождения пуст');
        return;
      }

      let message = '🎂 Список дней рождения:\n\n';
      
      people.forEach(person => {
        const age = this.peopleService.getPersonAge(person);
        const mention = person.telegramUsername ? `@${person.telegramUsername}` : person.name;
        message += `👤 ${mention}\n📅 ${person.birthDate} (${age} лет)\n\n`;
      });

      this.bot.sendMessage(chatId, message);
    });

    // Обработчик команды /today
    this.bot.onText(/\/today/, (msg) => {
      const chatId = msg.chat.id;
      const birthdayPeople = this.peopleService.getPeopleWithBirthdayToday();
      
      if (birthdayPeople.length === 0) {
        this.bot.sendMessage(chatId, '🎈 Сегодня нет именинников');
        return;
      }

      let message = '🎉 Сегодняшние именинники:\n\n';
      
      birthdayPeople.forEach(person => {
        const age = this.peopleService.getPersonAge(person);
        const mention = person.telegramUsername ? `@${person.telegramUsername}` : person.name;
        message += `🎂 ${mention} (${age} лет)!\n`;
      });

      message += '\n🎊 Поздравляем с днём рождения!';
      this.bot.sendMessage(chatId, message);
    });

    // Обработчик ошибок
    this.bot.on('polling_error', (error) => {
      this.logger.error(`❌ Ошибка polling: ${error}`);
    });
  }

  /**
   * Cron задача для проверки дней рождения каждый день в 11:00
   */
  @Cron('0 11 * * *', {
    name: 'birthdayCheck',
    timeZone: 'Europe/Moscow',
  })
  async checkBirthdays() {
    this.logger.log('🕐 Запуск проверки дней рождения в 11:00');
    
    const birthdayPeople = this.peopleService.getPeopleWithBirthdayToday();
    
    if (birthdayPeople.length === 0) {
      this.logger.log('📭 Сегодня нет именинников');
      return;
    }

    // Отправляем поздравления
    for (const person of birthdayPeople) {
      await this.sendBirthdayCongratulations(person);
    }
  }

  /**
   * Отправить поздравление с днём рождения
   */
  private async sendBirthdayCongratulations(person: Person) {
    const age = this.peopleService.getPersonAge(person);
    const mention = person.telegramUsername ? `@${person.telegramUsername}` : person.name;
    
    const congratulationsMessage = `
🎉🎂🎊
С днём рождения, ${mention}! 🥳

Сегодня тебе исполняется ${age} лет! 🎈

Желаю тебе:
🌟 Здоровья и счастья
💪 Успехов во всех начинаниях
❤️ Любви и гармонии
🚀 Исполнения всех желаний

Пусть этот день будет наполнен радостью и улыбками! 🎁
    `.trim();

    try {
      await this.bot.sendMessage(this.chatId, congratulationsMessage);
      this.logger.log(`✅ Поздравление отправлено: ${person.name}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка отправки поздравления для ${person.name}:`, error);
    }
  }

  /**
   * Отправить тестовое сообщение
   */
  async sendTestMessage(message: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, message);
      this.logger.log('✅ Тестовое сообщение отправлено');
    } catch (error) {
      this.logger.error('❌ Ошибка отправки тестового сообщения:', error);
      throw error;
    }
  }

  /**
   * Получить информацию о боте
   */
  async getBotInfo(): Promise<any> {
    try {
      return await this.bot.getMe();
    } catch (error) {
      this.logger.error('❌ Ошибка получения информации о боте:', error);
      throw error;
    }
  }
}
