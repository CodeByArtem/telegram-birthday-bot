import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
const TelegramBot = require('node-telegram-bot-api');
import dayjs from 'dayjs';
import { PeopleService, Person } from '../people/people.service';
import { HolidaysService } from '../holidays/holidays.service';
import { AiService } from '../ai/ai.service';
import { ImageService } from '../image/image.service';

type TelegramBotInstance = InstanceType<typeof TelegramBot>;

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
      private readonly aiService: AiService,
      private readonly imageService: ImageService,
  ) {}

  async onModuleInit() {
    await new Promise(resolve => setTimeout(resolve, 2000));

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

    this.adminUsernames = admins.split(',').map(a => a.trim().toLowerCase());

    try {
      this.bot = new TelegramBot(token, {
        polling: true,
        request: {
          agentOptions: {
            keepAlive: false
          }
        }
      });

      await this.bot.deleteWebHook();
      this.logger.log('🔧 Вебхуки отменены, переключаемся на polling');
    } catch (error) {
      this.logger.error(`❌ Ошибка инициализации бота: ${error.message}`);
      throw error;
    }

    this.bot.on('message', (msg) => {
      this.logger.log(`📨 Получено сообщение: ${msg.text || '(без текста)'} от @${msg.from?.username || 'no username'} в чате ${msg.chat.id}`);
    });

    this.setupHandlers();

    this.logger.log('✅ Telegram бот успешно инициализирован');
    this.logger.log(`🔑 Админы: ${this.adminUsernames.join(', ')}`);
  }

  private isAdmin(username?: string): boolean {
    if (!username) return false;
    return this.adminUsernames.includes(username.toLowerCase());
  }

  private async isUserInChat(userId: number, chatId: string): Promise<boolean> {
    try {
      const member = await this.bot.getChatMember(chatId, userId);
      return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
      this.logger.error(`Ошибка проверки участника: ${error.message}`);
      return false;
    }
  }

  private setupHandlers() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcomeMessage = `
🎉 Добро пожаловать в Telegram Birthday Bot!

Я помогу тебе не забывать о днях рождения!

📋 Доступные команды:
/start - Показать это сообщение
/help - Помощь
/birthdays - Показать список всех дней рождения
/today - Показать сегодняшних именинников
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
/add ДД.ММ.ГГГГ @username [male|female] - добавить день рождения
/remove @username - удалить день рождения
/test_evening - тестировать поздравление 8 марта
/help_admin - полная админская справка

🎁 Особенности:
✅ Автоматические поздравления в 11:00
🌸 Особое поздравление 8 марта в 18:00
📱 Красивые поздравления с картинками

⏰ Время отправки:
• 11:00 - дни рождения
• 18:00 - поздравление 8 марта (только 8 марта)
      `.trim();

      this.bot.sendMessage(chatId, helpMessage);
    });

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

    // /test_evening — тест поздравления 8 марта (только для админов)
    this.bot.onText(/\/test_evening/, async (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

      this.logger.log(`🧪 Попытка выполнения /test_evening от @${username || 'no username'}`);
      this.logger.log(`👑 Список админов: ${this.adminUsernames.join(', ')}`);

      if (!this.isAdmin(username)) {
        this.bot.sendMessage(chatId, '❌ Только администратор может тестировать поздравления!');
        return;
      }

      this.logger.log('🧪 Тестирование поздравления с 8 марта');

      const allPeople = this.peopleService.getAllPeople();
      const women = this.holidaysService.getWomen(allPeople);
      this.logger.log(`👥 Всего людей в базе: ${allPeople.length}`);
      this.logger.log(`👭 Женщин найдено: ${women.length}`);

      await this.sendWomensDayCongratulations();
      this.bot.sendMessage(chatId, '✅ Поздравление с 8 марта отправлено для теста!');
    });

    this.bot.onText(/\/ai_test/, async (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

      if (!this.isAdmin(username)) {
        this.bot.sendMessage(chatId, '❌ Только администратор может тестировать AI!');
        return;
      }

      this.logger.log('🤖 Тестирование AI генерации поздравления');

      try {
        const allPeople = this.peopleService.getAllPeople();
        const women = this.holidaysService.getWomen(allPeople);

        if (women.length === 0) {
          this.bot.sendMessage(chatId, '❌ В списке нет женщин для поздравления');
          return;
        }

        await this.sendWomensDayCongratulations();
        this.bot.sendMessage(chatId, `✅ AI поздравление отправлено для ${women.length} женщин!`);
      } catch (error) {
        this.logger.error('Ошибка AI генерации:', error);
        this.bot.sendMessage(chatId, '❌ Ошибка AI генерации, проверьте логи');
      }
    });

    this.bot.onText(/\/ai_birthday (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

      if (!this.isAdmin(username)) {
        this.bot.sendMessage(chatId, '❌ Только администратор может тестировать AI!');
        return;
      }

      const targetUsername = match[1].replace('@', '');

      try {
        const person = this.peopleService.getPersonByUsername(targetUsername);
        if (!person) {
          this.bot.sendMessage(chatId, `❌ Пользователь @${targetUsername} не найден`);
          return;
        }

        await this.sendAiGeneratedGreeting({
          name: 'День рождения',
          recipientName: person.name
        });
        this.bot.sendMessage(chatId, `✅ AI поздравление с днем рождения для ${person.name} отправлено!`);
      } catch (error) {
        this.logger.error('Ошибка AI генерации:', error);
        this.bot.sendMessage(chatId, '❌ Ошибка AI генерации, проверьте логи');
      }
    });

    this.bot.onText(/\/ai_holiday (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

      if (!this.isAdmin(username)) {
        this.bot.sendMessage(chatId, '❌ Только администратор может тестировать AI!');
        return;
      }

      const holidayName = match[1];

      try {
        await this.sendAiGeneratedGreeting({ name: holidayName });
        this.bot.sendMessage(chatId, `✅ AI поздравление с ${holidayName} отправлено!`);
      } catch (error) {
        this.logger.error('Ошибка AI генерации:', error);
        this.bot.sendMessage(chatId, '❌ Ошибка AI генерации, проверьте логи');
      }
    });

    this.bot.onText(/\/ai_status/, async (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

      if (!this.isAdmin(username)) {
        this.bot.sendMessage(chatId, '❌ Только администратор может проверять AI статус!');
        return;
      }

      try {
        const status = await this.testAiServices();

        const statusMessage = `
🤖 Статус AI сервисов:

🧠 Google Gemini AI: ${status.ai ? '✅ Доступен' : '❌ Недоступен'}
🎨 Генерация изображений: ${status.image ? '✅ Доступна' : '❌ Недоступна'}

${status.ai ? '✅ AI генерация работает' : '❌ Проверьте GOOGLE_GEMINI_API_KEY'}
${status.image ? '✅ Stable Diffusion работает' : '❌ Проверьте HUGGINGFACE_API_KEY'}
        `.trim();

        this.bot.sendMessage(chatId, statusMessage);
      } catch (error) {
        this.logger.error('Ошибка проверки AI статуса:', error);
        this.bot.sendMessage(chatId, '❌ Ошибка проверки статуса AI сервисов');
      }
    });

    this.bot.onText(/\/help_admin/, (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

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
/test_evening - тестировать поздравление 8 марта (картинка + AI текст + ники)
/ai_birthday @username - тестировать AI поздравление с днем рождения
/ai_holiday [название] - тестировать AI поздравление с праздником
/ai_status - проверить статус AI сервисов

📊 Статистика:
/birthdays - все дни рождения
/women - список женщин
/stats - статистика
/today - сегодняшние именинники

⏰ Время отправки:
• 11:00 - дни рождения
• 18:00 - поздравление 8 марта
      `.trim();

      this.bot.sendMessage(chatId, adminHelpMessage);
    });

    this.bot.onText(/\/whoami/, (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;
      const firstName = msg.from?.first_name;
      const userId = msg.from?.id;

      const debugInfo = `
🔍 Debug информация:
👤 Имя: ${firstName}
🏷️ Username: @${username || 'не указан'}
🆔 ID: ${userId}
💬 Chat ID: ${chatId}
👑 Админ?: ${this.isAdmin(username) ? 'Да' : 'Нет'}
      `.trim();

      this.bot.sendMessage(chatId, debugInfo);
    });

    this.bot.onText(/\/add (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

      if (!this.isAdmin(username)) {
        this.bot.sendMessage(chatId, `❌ Только администратор может добавлять дни рождения!`);
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

      const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
      if (!dateRegex.test(birthDate)) {
        this.bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ');
        return;
      }

      if (!telegramUsername || !telegramUsername.startsWith('@')) {
        this.bot.sendMessage(chatId, '❌ Username должен начинаться с @. Пример: @username');
        return;
      }

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

        if (gender) {
          person.gender = gender;
          await this.peopleService.saveData();
        }

        const genderText = gender === 'female' ? '🌸 женщина' : gender === 'male' ? '👨 мужчина' : '';
        this.bot.sendMessage(chatId,
            `✅ ${telegramUsername} добавлен в список дней рождения! ${genderText} 🎂\n\n` +
            `📝 Проверьте, что упоминание ${telegramUsername} кликабельное (синего цвета).`
        );

        this.logger.log(`✅ Добавлен пользователь: ${telegramUsername} (${birthDate}) - ${gender || 'пол не указан'}`);
      } catch (error) {
        this.bot.sendMessage(chatId, error.message);
        this.logger.error(`❌ Ошибка добавления: ${error.message}`);
      }
    });

    this.bot.onText(/\/remove (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username;

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

    this.bot.on('polling_error', (error) => {
      this.logger.error(`❌ Ошибка polling: ${error}`);
    });
  }

  /**
   * Cron: проверка дней рождения каждый день в 11:00
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
      await this.sendBirthdayAICongratulations();
    }
  }

  /**
   * Cron: поздравление с 8 марта в 18:00
   */
  @Cron('0 18 8 3 *', {
    name: 'womensDayEvening',
    timeZone: 'Europe/Kyiv',
  })
  async sendWomensDayCongratulations() {
    this.logger.log('🌸 Запуск поздравления с 8 марта');

    const allPeople = this.peopleService.getAllPeople();
    const women = this.holidaysService.getWomen(allPeople);

    this.logger.log(`👭 Женщин найдено: ${women.length}`);

    if (women.length === 0) {
      this.logger.log('👭 В списке нет женщин для поздравления');
      return;
    }

    // Формируем строку с упоминаниями всех женщин
    const mentions = women
        .map(w => w.telegramUsername ? `@${w.telegramUsername}` : w.name)
        .join(', ');

    // Генерируем AI поздравление (текст + картинка) с упоминанием всех женщин
    try {
      await this.sendAiGeneratedGreeting({
        name: '8 марта',
        recipientName: mentions,
      });
      this.logger.log(`✅ Поздравление с 8 марта отправлено для ${women.length} женщин`);
    } catch (error) {
      this.logger.error('❌ Ошибка отправки поздравления с 8 марта:', error);

      // Фолбэк — простое текстовое поздравление
      const fallbackMessage = `
🌸✨ С 8 МАРТА, ДОРОГИЕ! ✨🌸

🌺 Поздравляем: ${mentions}

🌷 Пусть этот день принесёт вам радость, тепло и улыбки!
💖 С праздником весны!
      `.trim();

      try {
        await this.bot.sendMessage(this.chatId, fallbackMessage);
        this.logger.log('📝 Фолбэк-поздравление отправлено');
      } catch (fallbackError) {
        this.logger.error('❌ Ошибка отправки фолбэк-поздравления:', fallbackError);
      }
    }
  }

  /**
   * AI поздравления с днем рождения каждому имениннику отдельно
   */
  private async sendBirthdayAICongratulations() {
    this.logger.log('🎂 Запуск AI поздравления с днем рождения');

    const birthdayPeople = this.peopleService.getPeopleWithBirthdayToday();

    if (birthdayPeople.length === 0) {
      this.logger.warn('Нет именинников для поздравления.');
      return;
    }

    for (const person of birthdayPeople) {
      try {
        await this.sendAiGeneratedGreeting({
          name: 'День рождения',
          recipientName: person.telegramUsername ? `@${person.telegramUsername}` : person.name,
        });
        this.logger.log(`🎂 AI поздравление с днем рождения отправлено для ${person.name}`);
      } catch (error) {
        this.logger.error(`❌ Ошибка AI поздравления для ${person.name}:`, error);
      }
    }
  }

  /**
   * Отправить поздравление с днём рождения (простое, без AI)
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

  async sendTestMessage(message: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, message);
      this.logger.log('✅ Тестовое сообщение отправлено');
    } catch (error) {
      this.logger.error('❌ Ошибка отправки тестового сообщения:', error);
      throw error;
    }
  }

  async getBotInfo(): Promise<any> {
    try {
      return await this.bot.getMe();
    } catch (error) {
      this.logger.error('❌ Ошибка получения информации о боте:', error);
      throw error;
    }
  }

  /**
   * Отправка AI сгенерированного поздравления с изображением
   */
  async sendAiGeneratedGreeting(holidayData: { name: string; recipientName?: string }): Promise<void> {
    try {
      this.logger.log(`🤖 Начало AI генерации поздравления: ${holidayData.name}`);

      // 1. Генерируем промпт
      let prompt: string;
      try {
        prompt = await this.aiService.generatePrompt(holidayData);
        this.logger.log(`✅ AI промпт сгенерирован: ${prompt.substring(0, 100)}...`);
      } catch (error) {
        this.logger.warn('⚠️ AI генерация промпта не удалась, используем резервный');
        prompt = this.aiService.getFallbackPrompt(holidayData);
      }

      // 2. Генерируем изображение
      let imageBuffer: Buffer;
      try {
        imageBuffer = await this.imageService.generateImage({
          name: holidayData.name,
          recipientName: holidayData.recipientName,
          prompt: prompt,
        });
        this.logger.log(`✅ Изображение сгенерировано, размер: ${imageBuffer.length} байт`);
      } catch (error) {
        this.logger.error('❌ Генерация изображения не удалась:', error);
        throw error;
      }

      // 3. Генерируем текст поздравления
      let greetingText: string;
      try {
        greetingText = await this.aiService.generateGreetingText(holidayData);
        this.logger.log('✅ Текст поздравления сгенерирован');
      } catch (error) {
        this.logger.warn('⚠️ AI генерация текста не удалась, используем резервный');
        greetingText = this.aiService.getFallbackGreetingText(holidayData);
      }

      // Если есть получатели — добавляем их в начало подписи
      const caption = holidayData.recipientName
          ? `${greetingText}\n\n${holidayData.recipientName}`
          : greetingText;

      // 4. Отправляем фото с подписью
      try {
        await this.bot.sendPhoto(this.chatId, imageBuffer, {
          caption,
          parse_mode: 'HTML',
        }, { filename: 'celebration.png', contentType: 'image/png' });
        this.logger.log('✅ AI поздравление успешно отправлено в Telegram');
      } catch (error) {
        this.logger.error('❌ Ошибка отправки фото в Telegram:', error);

        // Фолбэк — только текст
        try {
          await this.bot.sendMessage(this.chatId, caption);
          this.logger.log('✅ Текстовое поздравление отправлено как запасной вариант');
        } catch (textError) {
          this.logger.error('❌ Ошибка отправки текста:', textError);
          throw textError;
        }
      }
    } catch (error) {
      this.logger.error('❌ Общая ошибка AI генерации поздравления:', error);
      throw error;
    }
  }

  async testAiServices(): Promise<{ ai: boolean; image: boolean }> {
    try {
      const aiAvailable = await this.aiService.isAiAvailable();

      let imageAvailable = false;
      try {
        const testImage = await this.imageService.generateImage({
          name: 'Тест',
          prompt: 'simple test image, solid color',
        });
        imageAvailable = testImage && testImage.length > 0;
      } catch (error) {
        this.logger.warn('⚠️ Генерация изображений недоступна:', error.message);
      }

      return { ai: aiAvailable, image: imageAvailable };
    } catch (error) {
      this.logger.error('❌ Ошибка тестирования AI сервисов:', error);
      return { ai: false, image: false };
    }
  }
}