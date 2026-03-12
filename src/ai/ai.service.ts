import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export enum GreetingStyle {
  OFFICIAL = 'official',
  FUNNY = 'funny', 
  POETIC = 'poetic',
  FRIENDLY = 'friendly',
  ROMANTIC = 'romantic'
}

export enum GreetingLanguage {
  RUSSIAN = 'russian',
  UKRAINIAN = 'ukrainian',
  ENGLISH = 'english'
}

export interface HolidayPromptData {
  name: string;
  recipientName?: string;
  customPrompt?: string;
  style?: GreetingStyle;
  language?: GreetingLanguage;
  recipientInfo?: {
    age?: number;
    gender?: 'male' | 'female';
    interests?: string[];
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GOOGLE_GEMINI_API_KEY не найден, AI генерация будет отключена');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async generatePrompt(holidayData: HolidayPromptData): Promise<string> {
    try {
      const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('API ключ Google Gemini не настроен');
      }

      const model = this.genAI.getGenerativeModel(
          { model: 'gemini-1.5-flash' },
          { apiVersion: 'v1beta' }
      );

      const style = holidayData.style || GreetingStyle.FRIENDLY;
      const language = holidayData.language || GreetingLanguage.RUSSIAN;
      const recipientInfo = holidayData.recipientInfo || {};

      const stylePrompts = {
        [GreetingStyle.OFFICIAL]: 'официальный стиль, строгие цвета, деловая атмосфера, элегантность, сдержанность',
        [GreetingStyle.FUNNY]: 'веселый стиль, яркие сочные цвета, смешные элементы, праздничный юмор, анимация',
        [GreetingStyle.POETIC]: 'поэтический стиль, нежные пастельные тона, цветы, романтика, мечтательная атмосфера',
        [GreetingStyle.FRIENDLY]: 'дружеский стиль, теплые уютные цвета, позитив, дружба, счастливые моменты',
        [GreetingStyle.ROMANTIC]: 'романтичный стиль, розовые и красные тона, сердца, свечи, нежность, любовь'
      };

      const basePrompts = {
        '8 марта': {
          [GreetingStyle.OFFICIAL]: 'официальный плакат с 8 марта, строгие цветы делового стиля, элегантные розы, сдержанная палитра',
          [GreetingStyle.FUNNY]: 'веселый плакат с 8 марта, яркие смешные цветы, шутливые элементы, праздничные шары, мультяшные персонажи',
          [GreetingStyle.POETIC]: 'поэтический плакат с 8 марта, нежные весенние цветы, пастельные тона, романтичные сцены, мечтательная атмосфера',
          [GreetingStyle.FRIENDLY]: 'дружеский плакат с 8 марта, теплые цветы, уютная атмосфера, счастливые женщины, позитивные эмоции',
          [GreetingStyle.ROMANTIC]: 'романтичный плакат с 8 марта, красивые розы, сердца, нежные тона, романтические сцены, свечи'
        },
        'День рождения': {
          [GreetingStyle.OFFICIAL]: 'официальный праздничный плакат, торжественный торт, элегантные свечи, сдержанные цвета, деловой стиль',
          [GreetingStyle.FUNNY]: 'веселый день рождения, смешной торт, яркие шары, забавные подарки, юмористические элементы, карнавал',
          [GreetingStyle.POETIC]: 'поэтический день рождения, красивые цветы, нежные свечи, мечтательная атмосфера, романтичные детали',
          [GreetingStyle.FRIENDLY]: 'дружеский день рождения, уютный торт, теплые цвета, счастливые моменты, позитивная атмосфера',
          [GreetingStyle.ROMANTIC]: 'романтичный день рождения, свечи, розы, сердца, нежные тона, интимная обстановка, любовь'
        },
        'Новый год': {
          [GreetingStyle.OFFICIAL]: 'официальный новогодний плакат, элегантная елка, сдержанные украшения, деловой стиль, торжественность',
          [GreetingStyle.FUNNY]: 'веселый Новый год, смешной Дед Мороз, яркие подарки, шутливые снежинки, праздничный юмор',
          [GreetingStyle.POETIC]: 'поэтический Новый год, волшебный снег, мечтательные сцены, романтическая зима, сказочная атмосфера',
          [GreetingStyle.FRIENDLY]: 'дружеский Новый год, уютная елка, теплые огни, семейное счастье, позитивные эмоции',
          [GreetingStyle.ROMANTIC]: 'романтичный Новый год, свечи, снег, нежные моменты, зимняя романтика, любовь под снегом'
        }
      };

      const languagePrompts = {
        [GreetingLanguage.RUSSIAN]: 'Создай промпт на русском языке',
        [GreetingLanguage.UKRAINIAN]: 'Створи промпт українською мовою',
        [GreetingLanguage.ENGLISH]: 'Create prompt in English language'
      };

      const basePrompt = holidayData.customPrompt ||
          basePrompts[holidayData.name]?.[style] ||
          stylePrompts[style] + ', праздничная тема';

      const recipientText = holidayData.recipientName
          ? ` с персонализацией для ${holidayData.recipientName}`
          : '';
      
      const genderText = recipientInfo.gender
          ? recipientInfo.gender === 'female' ? ' для женщины' : ' для мужчины'
          : '';

      const fullPrompt = `
${languagePrompts[language]}

Создай детальный промпт для генерации праздничного изображения в стиле Stable Diffusion:

${basePrompt}${recipientText}${genderText}

Художественный стиль: ${stylePrompts[style]}

Требования к промпту:
- Яркий, красочный дизайн соответствующий стилю
- Праздничная атмосфера  
- Высокое качество, детализация
- Позитивные эмоции
- Без текста на изображении (только визуальные элементы)
- Стиль: digital art, high resolution, vibrant colors
- Размер: 512x512 пикселей
- Уникальная композиция

Ответь только промптом для генерации изображения, без лишнего текста.
Пример хорошего ответа: "beautiful spring flowers, International Women's Day, pink and purple colors, festive atmosphere, high quality, detailed"
      `.trim();

      const result = await model.generateContent(fullPrompt);
      const prompt = result.response.text().trim();

      this.logger.log(`Сгенерирован промпт: ${holidayData.name} (${style}, ${language})`);
      return prompt;
    } catch (error) {
      this.logger.error('Ошибка генерации промпта:', error);
      throw error;
    }
  }

  getFallbackPrompt(holidayData: HolidayPromptData): string {
    const recipientText = holidayData.recipientName
        ? ` with personalized greeting for ${holidayData.recipientName}`
        : '';

    const fallbacks = {
      '8 марта': `beautiful spring flowers, International Women\'s Day, pink and purple colors, festive atmosphere, high quality, detailed${recipientText}`,
      'Рождество': `Christmas tree, snow, winter wonderland, festive lights, warm colors, magical atmosphere, high quality${recipientText}`,
      'День рождения': `birthday cake with candles, colorful balloons, celebration, festive atmosphere, bright colors, high quality${recipientText}`,
      'Новый год': `New Year celebration, Christmas tree, gifts, snowflakes, festive atmosphere, high quality, detailed${recipientText}`,
      'Пасха': `Easter celebration, decorated eggs, spring flowers, bright colors, festive atmosphere, high quality${recipientText}`,
    };

    return fallbacks[holidayData.name] ||
        `festive celebration, colorful design, high quality, detailed image${recipientText}`;
  }

  async generateGreetingText(holidayData: HolidayPromptData): Promise<string> {
    try {
      const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
      if (!apiKey) {
        return this.getFallbackGreetingText(holidayData);
      }

      const model = this.genAI.getGenerativeModel(
          { model: 'gemini-1.5-flash' },
          { apiVersion: 'v1beta' }
      );

      const style = holidayData.style || GreetingStyle.FRIENDLY;
      const recipientText = holidayData.recipientName
          ? ` для ${holidayData.recipientName}`
          : '';

      const styleInstructions = {
        [GreetingStyle.OFFICIAL]: 'Напиши официальное, торжественное поздравление. Используй уважительный тон, формальные выражения.',
        [GreetingStyle.FUNNY]: 'Напиши веселое, шутливое поздравление. Используй юмор, позитив, забавные выражения.',
        [GreetingStyle.POETIC]: 'Напиши поэтическое поздравление. Используй красивые метафоры, рифмы, образный язык.',
        [GreetingStyle.FRIENDLY]: 'Напиши дружеское, теплое поздравление. Используй неформальный, но уважительный тон.',
        [GreetingStyle.ROMANTIC]: 'Напиши романтичное поздравление. Используй нежные слова, комплименты, теплые выражения.'
      };

      const prompt = `
${styleInstructions[style]}

Напиши красивое поздравление с ${holidayData.name}${recipientText}.

Требования:
- Текст должен быть теплым и искренним
- Включи эмодзи для настроения
- Длина: 2-3 предложения
- Без лишних формальностей
- На русском языке
- НЕ упоминай имена получателей в тексте — только само поздравление
- Отвечай ТОЛЬКО текстом поздравления, без вступлений типа "Вот поздравление:", "Конечно!", "Вариант 1:" и т.д.
- Пиши только ОДНО поздравление, без вариантов

Пример для дружеского стиля: "🌸 С 8 марта! Желаю весеннего настроения, красоты и счастья! 🌷"
Пример для официального стиля: "🎊 Поздравляю с 8 марта! Желаю профессиональных успехов и личного благополучия! ✨"
Пример для веселого стиля: "🎉 С днем рождения! Пусть жизнь будет как яркий карнавал! 🎈🎊"
Пример для поэтического стиля: "🌟 Как весенний цветок, пусть расцветает твоя душа в этот праздник! 🌺✨"
      `.trim();

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      this.logger.log(`Сгенерирован текст (${style}): ${holidayData.name}`);
      return text;
    } catch (error) {
      this.logger.error('Ошибка генерации текста поздравления:', error);
      return this.getFallbackGreetingText(holidayData);
    }
  }

  /**
   * Автоматический выбор случайного стиля поздравления
   */
  getRandomStyle(): GreetingStyle {
    const styles = Object.values(GreetingStyle);
    return styles[Math.floor(Math.random() * styles.length)];
  }

  /**
   * Получение красивого случайного стиля для праздника
   */
  getSmartStyle(holidayName: string, recipientInfo?: { gender?: 'male' | 'female' }): GreetingStyle {
    // Для 8 марта всегда нежные стили
    if (holidayName === '8 марта') {
      const womenStyles = [GreetingStyle.POETIC, GreetingStyle.ROMANTIC, GreetingStyle.FRIENDLY];
      return womenStyles[Math.floor(Math.random() * womenStyles.length)];
    }

    // Для официальных праздников
    if (holidayName === 'Новый год' || holidayName === 'Рождество') {
      const holidayStyles = [GreetingStyle.FRIENDLY, GreetingStyle.OFFICIAL, GreetingStyle.POETIC];
      return holidayStyles[Math.floor(Math.random() * holidayStyles.length)];
    }

    // Для дней рождения - учитываем только пол
    if (holidayName === 'День рождения') {
      if (recipientInfo?.gender === 'female') {
        // Для женщин более нежные стили
        const womenStyles = [GreetingStyle.POETIC, GreetingStyle.ROMANTIC, GreetingStyle.FRIENDLY, GreetingStyle.FUNNY];
        return womenStyles[Math.floor(Math.random() * womenStyles.length)];
      }
      
      // Для мужчин и по умолчанию
      const styles = [GreetingStyle.FRIENDLY, GreetingStyle.FUNNY, GreetingStyle.OFFICIAL, GreetingStyle.POETIC];
      return styles[Math.floor(Math.random() * styles.length)];
    }

    // По умолчанию случайный стиль
    return this.getRandomStyle();
  }

  getFallbackGreetingText(holidayData: HolidayPromptData): string {
    const greetings = {
      '8 марта': `🌸 С 8 марта! Желаю весеннего настроения, красоты и счастья! 🌷`,
      'Рождество': `🎄 С Рождеством! Пусть волшебство этого дня принесет радость и чудеса! 🌟`,
      'День рождения': `🎂 С днем рождения! Пусть все мечты сбываются! 🎉`,
      'Новый год': `🎊 С Новым годом! Пусть наступающий год принесет счастье и успех! 🎆`,
      'Пасха': `🐣 С Христовым Воскресением! Пусть светлая Пасха принесет радость и мир! ✨`,
    };

    return greetings[holidayData.name] ||
        `🎉 Поздравляю с ${holidayData.name}! Желаю счастья и радости! 🌟`;
  }

  // ✅ Исправлено: gemini-pro → gemini-1.5-flash
  async isAiAvailable(): Promise<boolean> {
    try {
      const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
      if (!apiKey) return false;

      const model = this.genAI.getGenerativeModel(
          { model: 'gemini-1.5-flash' },
          { apiVersion: 'v1beta' }
      );
      await model.generateContent('test');
      return true;
    } catch (error) {
      this.logger.warn('AI сервис недоступен:', error.message);
      return false;
    }
  }
}