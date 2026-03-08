import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface HolidayPromptData {
  name: string;
  recipientName?: string;
  customPrompt?: string;
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

      // ✅ Исправлено: gemini-pro → gemini-1.5-flash
      const model = this.genAI.getGenerativeModel(
          { model: 'gemini-2.5-flash' },
          { apiVersion: 'v1beta' }
      );

      const basePrompts = {
        '8 марта': 'красивый праздничный плакат с 8 марта, цветы, весна, нежные цвета, поздравления для женщин',
        'Рождество': 'новогодний праздничный плакат, Рождество, елка, снеговик, волшебная атмосфера',
        'День рождения': 'праздничный торт с свечами, яркие цвета, поздравление с днем рождения',
        'Новый год': 'новогодний плакат, елка, подарки, снежинки, праздничная атмосфера',
        'Пасха': 'пасхальный плакат, яйца, куличи, весна, светлые цвета',
      };

      const basePrompt = holidayData.customPrompt ||
          basePrompts[holidayData.name] ||
          'праздничный плакат, яркие цвета, торжество';

      const recipientText = holidayData.recipientName
          ? ` с персональным поздравлением для ${holidayData.recipientName}`
          : '';

      const fullPrompt = `
Создай детальный промпт для генерации праздничного изображения в стиле Stable Diffusion на английском языке:

${basePrompt}${recipientText}

Требования к промпту:
- Яркий, красочный дизайн
- Праздничная атмосфера  
- Высокое качество, детализация
- Позитивные эмоции
- Без текста на изображении (только визуальные элементы)
- Стиль: digital art, high resolution, vibrant colors
- Размер: 512x512 пикселей

Ответь только промптом для генерации изображения, без лишнего текста.
Пример хорошего ответа: "beautiful spring flowers, International Women's Day, pink and purple colors, festive atmosphere, high quality, detailed"
      `.trim();

      const result = await model.generateContent(fullPrompt);
      const prompt = result.response.text().trim();

      this.logger.log(`Сгенерирован промпт для праздника: ${holidayData.name}`);
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

      // ✅ Исправлено: gemini-pro → gemini-1.5-flash
      const model = this.genAI.getGenerativeModel(
          { model: 'gemini-2.5-flash' },
          { apiVersion: 'v1beta' }
      );

      const recipientText = holidayData.recipientName
          ? ` для ${holidayData.recipientName}`
          : '';

      const prompt = `
Напиши красивое поздравление с ${holidayData.name}${recipientText}.

Требования:
- Текст должен быть теплым и искренним
- Включи эмодзи для настроения
- Длина: 2-3 предложения
- Без лишних формальностей
- На русском языке
- НЕ упоминай имена получателей в тексте — только само поздравление

Пример: "🌸 С 8 марта! Желаю весеннего настроения, красоты и счастья! 🌷"
      `.trim();

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      this.logger.log(`Сгенерирован текст поздравления для: ${holidayData.name}`);
      return text;
    } catch (error) {
      this.logger.error('Ошибка генерации текста поздравления:', error);
      return this.getFallbackGreetingText(holidayData);
    }
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
          { model: 'gemini-2.5-flash' },
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