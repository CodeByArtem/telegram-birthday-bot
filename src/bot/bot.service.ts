import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
const TelegramBot = require('node-telegram-bot-api');
import dayjs from 'dayjs';  // ✅ ИСПРАВЛЕНО: было const dayjs = require('dayjs')
import { PeopleService, Person } from '../people/people.service';
import { HolidaysService } from '../holidays/holidays.service';

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
  private adminUsernames: string[];

  constructor(
      private readonly configService: ConfigService,
      private readonly peopleService: PeopleService,
      private readonly holidaysService: HolidaysService,
  ) {}

  /**
   * Инициализация бота при запуске модуля
   */
  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');
    const admins = this.configService.get<string>('ADMIN_USERNAMES') || '';

    if (!token) {
      this.logger.error('❌ TELEGRAM_BOT_TOKEN не найден в переменных окружения');
      throw new Error('TELEGRAM_BOT_TOKEN обязателен');
    }

    if (!this.chatId) {
      this.logger.error('❌ TELEGRAM_CHAT_ID не найден в переменных окружения');
      throw new Error('TELEGRAM_CHAT_ID обязателен');
    }

    // Парсим админов
    this.adminUsernames = admins.split(',').map(a => a.trim().toLowerCase());

    // Создаем экземпляр бота
    this.bot = new TelegramBot(token, { polling: true });

    // Настраиваем обработчики команд
    this.setupHandlers();

    this.logger.log('✅ Telegram бот успешно инициализирован');
    this.logger.log(`🔑 Админы: ${this.adminUsernames.join(', ')}`);
  }

  /**
   * Проверить, является ли пользователь админом
   */
  private isAdmin(username?: string): boolean {
    if (!username) return false;
    return this.adminUsernames.includes(username.toLowerCase());
  }

  /**
   * Проверить, что пользователь есть в чате
   */
  private async isUserInChat(userId: number, chatId: string): Promise<boolean> {
    try {
      const member = await this.bot.getChatMember(chatId, userId);
      return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
      this.logger.error(`Ошибка проверки участника: ${error.message}`);
      return false;
    }
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
/stats - Статистика дней рождения
/women - Показать список женщин

🔒 Админские команды (только для админов):
/add ДД.ММ.ГГГГ @username [male|female] - добавить день рождения с указанием пола
/remove @username - удалить день рождения

🎁 Поздравления теперь с картинками! 🎉
🌸 Автоматические поздравления с 8 марта! 🌺

🕐 Каждый день в 11:00 я проверяю список и поздравляю именинников!
      `.trim();

      this.bot.sendMessage(chatId, welcomeMessage);
    });

    // Обработчик команды /help
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const helpMessage = `
📖 Справка по командам:

📋 Основные команды:
/start - Приветственное сообщение
/help - Эта справка
/birthdays - Полный список дней рождения
/today - Сегодняшние именинники
/stats - Статистика дней рождения
/women - Список женщин в системе

🔒 Админские команды:
/add ДД.ММ.ГГГГ @username [male|female] - добавить день рождения с указанием пола  
/remove @username - удалить день рождения
/test_evening - тестировать вечернее поздравление 8 марта
/help_admin - полная админская справка

🎁 Особенности:
✅ Автоматические поздравления в 11:00
🌸 Особое поздравление 8 марта в 18:00
📱 Красивые поздравления с картинками
🎂 Поздравления с возрастом и красивыми пожеланиями

⏰ Время отправки:
• 11:00 - дни рождения
• 18:00 - вечернее поздравление 8 марта (только 8 марта)
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
        // Всегда используем @username если есть, иначе просто имя
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
        // Всегда используем @username если есть, иначе просто имя
        const mention = person.telegramUsername ? `@${person.telegramUsername}` : person.name;
        message += `🎂 ${mention} (${age} лет)!\n`;
      });

      message += '\n🎊 Поздравляем с днём рождения!';
      this.bot.sendMessage(chatId, message);
    });

    // Обработчик команды /stats
    this.bot.onText(/\/stats/, async (msg) => {
      const chatId = msg.chat.id;
      const stats = this.peopleService.getBirthdayStats();

      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

      const currentMonth = months[dayjs().month()];
      const nextMonth = months[dayjs().add(1, 'month').month()];

      let message = `📊 Статистика дней рождения:\n\n`;
      message += `👥 Всего людей: ${stats.total}\n`;
      message += `🎂 В этом месяце (${currentMonth}): ${stats.thisMonth}\n`;
      message += `🎈 В следующем месяце (${nextMonth}): ${stats.nextMonth}\n`;
      message += `📈 В среднем в месяц: ${stats.averagePerMonth}\n\n`;

      message += `📅 По месяцам:\n`;
      stats.monthlyStats.forEach(stat => {
        if (stat.count > 0) {
          message += `${months[stat.month - 1]}: ${stat.count}\n`;
        }
      });

      await this.bot.sendMessage(chatId, message);
    });

    // Обработчик команды /women
    this.bot.onText(/\/women/, (msg) => {
      const chatId = msg.chat.id;
      const allPeople = this.peopleService.getAllPeople();
      const women = this.holidaysService.getWomen(allPeople);

      if (women.length === 0) {
        this.bot.sendMessage(chatId, '👭 В списке нет женщин');
        return;
      }

      let message = '🌸🌺🌷 Женщины в списке:\n\n';

      women.forEach(woman => {
        const mention = woman.telegramUsername ? `@${woman.telegramUsername}` : woman.name;
        message += `🌺 ${mention}\n\n`;
      });

      this.bot.sendMessage(chatId, message);
    });

    // Обработчик команды /test_evening (только для админов)
    this.bot.onText(/\/test_evening/, async (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

      // Проверка прав админа
      if (!this.isAdmin(username)) {
        this.bot.sendMessage(chatId, '❌ Только администратор может тестировать поздравления!');
        return;
      }

      this.logger.log('🧪 Тестирование вечернего поздравления с 8 марта');
      await this.sendWomensDayEveningCongratulations();
      this.bot.sendMessage(chatId, '✅ Вечернее поздравление с 8 марта отправлено для теста!');
    });

    // Обработчик команды /help_admin (только для админов)
    this.bot.onText(/\/help_admin/, (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

      // Проверка прав админа
      if (!this.isAdmin(username)) {
        this.bot.sendMessage(chatId, '❌ Только администратор может видеть эту справку!');
        return;
      }

      const adminHelpMessage = `
🔧 Админские команды:

📋 Управление:
/add ДД.ММ.ГГГГ @username [male|female] - добавить пользователя
/remove @username - удалить пользователя

🧪 Тестирование:
/test_evening - тестировать вечернее поздравление 8 марта

📊 Статистика:
/birthdays - все дни рождения
/women - список женщин
/stats - статистика
/today - сегодняшние именинники

⏰ Время отправки:
• 11:00 - дни рождения
• 18:00 - вечернее поздравление 8 марта (только 8 марта)
      `.trim();

      this.bot.sendMessage(chatId, adminHelpMessage);
    });

    // Обработчик команды /add (только для админов)
    this.bot.onText(/\/add (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

      // Проверка прав админа
      if (!this.isAdmin(username)) {
        this.bot.sendMessage(chatId,
            `❌ Только администратор может добавлять дни рождения!`
        );
        return;
      }

      if (!match) {
        this.bot.sendMessage(chatId, '❌ Неверный формат. Используйте: /add ДД.ММ.ГГГГ @username [male|female]');
        return;
      }

      const args = match[1].split(' ');
      if (args.length < 2) {
        this.bot.sendMessage(chatId, '❌ Неверный формат. Используйте: /add ДД.ММ.ГГГГ @username [male|female]');
        return;
      }

      const birthDate = args[0];
      const telegramUsername = args[1];
      const gender = args[2] as 'male' | 'female' | undefined;

      // Проверка формата даты
      const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
      if (!dateRegex.test(birthDate)) {
        this.bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ');
        return;
      }

      // Проверка username
      if (!telegramUsername || !telegramUsername.startsWith('@')) {
        this.bot.sendMessage(chatId, '❌ Username должен начинаться с @. Пример: @username');
        return;
      }

      // Проверка пола если указан
      if (gender && !['male', 'female'].includes(gender)) {
        this.bot.sendMessage(chatId, '❌ Пол должен быть male или female');
        return;
      }

      try {
        const person = await this.peopleService.addPersonFromTelegramWithValidation(
            telegramUsername.replace('@', ''),
            birthDate,
            telegramUsername,
            this.bot,
            chatId.toString()
        );

        // Добавляем поле gender если указан
        if (gender) {
          person.gender = gender;
          await this.peopleService.saveData();
        }

        const genderText = gender === 'female' ? '🌸 женщина' : gender === 'male' ? '👨 мужчина' : '';
        this.bot.sendMessage(chatId,
            `✅ ${telegramUsername} добавлен в список дней рождения! ${genderText} 🎂\n\n` +
            `📝 Проверьте, что упоминание ${telegramUsername} кликабельное (синего цвета).\n` +
            `Если нет - пользователь не найден в чате или username указан неверно.`
        );

        this.logger.log(`✅ Добавлен пользователь: ${telegramUsername} (${birthDate}) - ${gender || 'пол не указан'}`);
      } catch (error) {
        this.bot.sendMessage(chatId, error.message);
        this.logger.error(`❌ Ошибка добавления: ${error.message}`);
      }
    });

    // Обработчик команды /remove (только для админов)
    this.bot.onText(/\/remove (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

      // Проверка прав админа
      if (!this.isAdmin(username)) {
        this.bot.sendMessage(chatId, `❌ Только администратор может удалять дни рождения!`);
        return;
      }

      if (!match) {
        this.bot.sendMessage(chatId, '❌ Неверный формат. Используйте: /remove @username');
        return;
      }

      const targetUsername = match[1].trim().replace('@', '');

      try {
        // Ищем человека по username
        const person = this.peopleService.getAllPeople().find(p =>
            p.telegramUsername?.toLowerCase() === targetUsername.toLowerCase()
        );

        if (!person) {
          this.bot.sendMessage(chatId, `❌ Пользователь @${targetUsername} не найден в списке дней рождения`);
          return;
        }

        const success = this.peopleService.removePerson(person.id);
        if (success) {
          this.bot.sendMessage(chatId, `✅ @${targetUsername} удален из списка дней рождения!`);
          this.logger.log(`✅ Удален пользователь: @${targetUsername}`);
        }
      } catch (error) {
        this.bot.sendMessage(chatId, `❌ Ошибка при удалении: ${error.message}`);
        this.logger.error(`❌ Ошибка удаления: ${error.message}`);
      }
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
    timeZone: 'Europe/Kyiv',
  })
  async checkBirthdays() {
    this.logger.log('🕐 Запуск проверки дней рождения в 11:00');

    const birthdayPeople = this.peopleService.getPeopleWithBirthdayToday();

    if (birthdayPeople.length === 0) {
      this.logger.log('📭 Сегодня нет именинников');
    } else {
      // Отправляем поздравления
      for (const person of birthdayPeople) {
        await this.sendBirthdayCongratulations(person);
      }
    }

    // Проверяем 8 марта - только вечернее поздравление
    if (this.holidaysService.isInternationalWomensDay()) {
      this.logger.log('🌸 Сегодня 8 марта - вечернее поздравление в 18:00!');
      // Утреннее поздравление отключено
    }
  }

  /**
   * Cron задача для красивого поздравления с 8 марта в 18:00
   */
  @Cron('0 18 8 3 *', {
    name: 'womensDayEvening',
    timeZone: 'Europe/Kyiv',
  })
  async sendWomensDayEveningCongratulations() {
    this.logger.log('🌆 Запуск вечернего поздравления с 8 марта в 18:00');

    const allPeople = this.peopleService.getAllPeople();
    const women = this.holidaysService.getWomen(allPeople);

    if (women.length === 0) {
      this.logger.log('👭 В списке нет женщин для вечернего поздравления');
      return;
    }

    this.logger.log(`🌸 Вечернее поздравление с 8 марта для ${women.length} женщин`);

    // Красивое поздравление
    const beautifulMessage = `
🌸✨🌺🌷🌹🌸✨🌺🌷🌹
🌸✨ С 8 МАРТА, НАШИ ЛЮБИМЫЕ! ✨🌸
🌺🌷🌹🌸✨🌺🌷🌹🌸✨

Вы — настоящие королевы этого дня! 👑
Ваша красота освещает мир! ✨
Ваша сила вдохновляет нас! 💪
Ваша нежность согревает сердца! ❤️

🌟 Пусть каждый ваш день будет наполнен:
   • Счастьем, что льется рекой 🌊
   • Любовью, что окрыляет 🕊️
   • Успехом во всех начинаниях 🎯
   • Радостью и улыбками 😊

🌺 Вы заслуживаете самого лучшего!
🌷 Будьте всегда любимы и желанны!
🌹 Пусть мечты сбываются мгновенно!

💖 С праздником весны, наши дорогие женщины! 💖
🌸✨🌺🌷🌹🌸✨🌺🌷🌹🌸✨

С любовью и восхищением! 🌟
    `.trim();

    // Красивая картинка для 8 марта
    const beautifulImage = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZkM2JqZzZqa3BiajFqamZ1d3ZqZ3NvY2ZxY2V3c2Fic2p6b3ZqbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l4FGhGhS1NQh1s1qU/giphy.gif';

    try {
      // Отправляем красивую картинку с поздравлением
      await this.bot.sendPhoto(this.chatId, beautifulImage, {
        caption: beautifulMessage
      });
      
      this.logger.log(`🌸 Вечернее поздравление с 8 марта отправлено для ${women.length} женщин`);
    } catch (error) {
      // Если картинка не загрузилась, отправляем просто текст
      try {
        await this.bot.sendMessage(this.chatId, beautifulMessage);
        this.logger.log(`🌸 Вечернее поздравление с 8 марта отправлено (текст) для ${women.length} женщин`);
      } catch (textError) {
        this.logger.error(`❌ Ошибка отправки вечернего поздравления с 8 марта:`, textError);
      }
    }
  }

  /**
   * Отправить поздравления с 8 марта
   */
  private async sendWomensDayCongratulations() {
    const allPeople = this.peopleService.getAllPeople();
    const women = this.holidaysService.getWomen(allPeople);

    if (women.length === 0) {
      this.logger.log('👭 В списке нет женщин для поздравления');
      return;
    }

    this.logger.log(`🌸 Отправка поздравлений с 8 марта для ${women.length} женщин`);

    // Создаем список всех женщин
    let message = '🌸🌺🌷 С 8 марта! 🌷🌺🌸\n\n';
    
    women.forEach(woman => {
      const mention = woman.telegramUsername ? `@${woman.telegramUsername}` : woman.name;
      message += `${mention}\n`;
    });

    try {
      // Отправляем одно сообщение со списком всех женщин
      await this.bot.sendMessage(this.chatId, message);
      this.logger.log(`🌸 Поздравление с 8 марта отправлено для ${women.length} женщин`);
    } catch (error) {
      this.logger.error(`❌ Ошибка отправки поздравления с 8 марта:`, error);
    }
  }

  /**
   * Отправить поздравление с днём рождения
   */
  private async sendBirthdayCongratulations(person: Person) {
    const age = this.peopleService.getPersonAge(person);
    // Всегда используем @username для упоминания, если есть
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
      // Случайная картинка поздравления
      const birthdayImages = [
        'https://media.giphy.com/media/3o7TKUtmGfJWg1t0wA/giphy.gif',
        'https://media.giphy.com/media/3o7aD5sa1j2oHcCJhi/giphy.gif',
        'https://media.giphy.com/media/l4FGkXHbV1k1sD4Hu/giphy.gif',
        'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif',
        'https://media.giphy.com/media/3oFzmme8JFS1Y8wPqe/giphy.gif'
      ];

      const randomImage = birthdayImages[Math.floor(Math.random() * birthdayImages.length)];

      // Отправляем картинку
      await this.bot.sendPhoto(this.chatId, randomImage, {
        caption: congratulationsMessage
      });

      this.logger.log(`✅ Поздравление отправлено: ${person.name} (@${person.telegramUsername || 'no username'})`);
    } catch (error) {
      // Если картинка не загрузилась, отправляем просто текст
      try {
        await this.bot.sendMessage(this.chatId, congratulationsMessage);
        this.logger.log(`✅ Поздравление отправлено (текст): ${person.name}`);
      } catch (textError) {
        this.logger.error(`❌ Ошибка отправки поздравления для ${person.name}:`, textError);
      }
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