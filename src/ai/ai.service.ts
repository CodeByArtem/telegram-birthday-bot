import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GroqService } from './groq.service';
import { AiOrchestrationService } from './ai-orchestration.service';

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

export interface HolidayImageData {
  name: string;
  style?: GreetingStyle;
  prompt?: string;
  recipientInfo?: {
    age?: number;
    gender?: 'male' | 'female';
    interests?: string[];
  };
  language?: GreetingLanguage;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private configService: ConfigService,
    private groqService: GroqService,
    private aiOrchestrationService: AiOrchestrationService
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GOOGLE_GEMINI_API_KEY не найден, AI генерация будет работать через Orchestration');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async generatePrompt(imageData: HolidayImageData): Promise<string> {
    try {
      // Используем AI Orchestration для генерации промпта
      const result = await this.aiOrchestrationService.generateImagePrompt(
        imageData.name,
        imageData.style || GreetingStyle.FRIENDLY,
        imageData.language || GreetingLanguage.RUSSIAN
      );

      this.logger.log(`✅ AI Orchestration промпт: ${result.provider} (${result.reasoning})`);
      return result.prompt;

    } catch (error) {
      this.logger.error('❌ Ошибка генерации промпта:', error.message);
      return this.getDefaultPrompt(imageData);
    }
  }

  async generateGreetingText(holidayData: HolidayPromptData): Promise<string> {
    try {
      // Используем AI Orchestration Layer для умного выбора модели
      const result = await this.aiOrchestrationService.generateGreetingText(holidayData, {
        style: holidayData.style || GreetingStyle.FRIENDLY,
        language: holidayData.language || GreetingLanguage.RUSSIAN,
        maxRetries: 2,
        timeout: 10000
      });

      this.logger.log(`✅ AI Orchestration: ${result.provider} сгенерировал текст (${result.reasoning})`);
      return result.text;

    } catch (error) {
      this.logger.error('❌ AI Orchestration ошибка:', error.message);
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

    // Для Нового года более официальные стили
    if (holidayName === 'Новый год') {
      const newYearStyles = [GreetingStyle.OFFICIAL, GreetingStyle.POETIC, GreetingStyle.FRIENDLY];
      return newYearStyles[Math.floor(Math.random() * newYearStyles.length)];
    }

    // Для дня рождения учитываем пол
    if (holidayName === 'День рождения') {
      // Для мужчин чаще официальный стиль
      if (recipientInfo?.gender === 'male') {
        const menStyles = [GreetingStyle.OFFICIAL, GreetingStyle.FRIENDLY, GreetingStyle.POETIC];
        return menStyles[Math.floor(Math.random() * menStyles.length)];
      }

      // Для женщин чаще нежные стили
      if (recipientInfo?.gender === 'female') {
        const womenStyles = [GreetingStyle.POETIC, GreetingStyle.ROMANTIC, GreetingStyle.FRIENDLY];
        return womenStyles[Math.floor(Math.random() * womenStyles.length)];
      }

      // Если пол не указан - случайный стиль
      return this.getRandomStyle();
    }

    // Для других праздников учитываем пол если есть
    if (recipientInfo?.gender === 'male') {
      const menStyles = [GreetingStyle.OFFICIAL, GreetingStyle.FRIENDLY, GreetingStyle.POETIC];
      return menStyles[Math.floor(Math.random() * menStyles.length)];
    }

    // Для женщин чаще нежные стили
    if (recipientInfo?.gender === 'female') {
      const womenStyles = [GreetingStyle.POETIC, GreetingStyle.ROMANTIC, GreetingStyle.FRIENDLY];
      return womenStyles[Math.floor(Math.random() * womenStyles.length)];
    }

    // По умолчанию случайный стиль
    return this.getRandomStyle();
  }

  /**
   * Получение промпта по умолчанию для генерации изображения (private)
   */
  private getDefaultPrompt(imageData: HolidayImageData): string {
    const recipientText = imageData.recipientInfo 
      ? ` for ${imageData.recipientInfo.age || 'adult'} year old ${imageData.recipientInfo.gender || 'person'}`
      : '';

    const fallbacks = {
      'День рождения': `festive birthday celebration, colorful balloons, cake, gifts, warm lighting, high quality, detailed${recipientText}`,
      '8 марта': `international women day celebration, spring flowers, elegant bouquet, soft lighting, professional photography, high quality${recipientText}`,
      'Новый год': `New Year celebration, Christmas tree, gifts, snowflakes, festive atmosphere, high quality, detailed${recipientText}`,
      'Пасха': `Easter celebration, decorated eggs, spring flowers, bright colors, festive atmosphere, high quality${recipientText}`,
    };

    return fallbacks[imageData.name] ||
        `festive celebration, colorful design, high quality, detailed image${recipientText}`;
  }

  /**
   * Получение заглушки для текста поздравления (private)
   */
  private getFallbackGreetingText(holidayData: HolidayPromptData): string {
    const recipientName = holidayData.recipientName || 'друг';
    const holiday = holidayData.name || 'праздник';
    const style = holidayData.style || GreetingStyle.FRIENDLY;

    const fallbackTexts = {
      [GreetingStyle.FRIENDLY]: `🎉 Поздравляю с ${holiday}, ${recipientName}! Желаю тебе огромного счастья, крепкого здоровья и исполнения всех желаний! Пусть каждый день будет наполнен радостью и улыбками! ✨`,
      [GreetingStyle.OFFICIAL]: `🎊 Уважаемый(ая) ${recipientName}! Примите мои искренние поздравления с ${holiday}! Желаю Вам профессиональных успехов, личного благополучия и дальнейших процветаний! С уважением, 🌹`,
      [GreetingStyle.FUNNY]: `🎈 С ${holiday}, ${recipientName}! Желаю тебе чтобы жизнь была как яркий карнавал - полный веселья, сюрпризов и чтобы печень всегда была сладкой! А еще чтобы деньги водились, а проблемы исчезали сами собой! 😄🎊`,
      [GreetingStyle.POETIC]: `🌸 В этот прекрасный день ${holiday}, ${recipientName}! Пусть твоя жизнь будет как весенний сад - расцветает с каждым днем, наполнена светом, теплом и гармонией! Желаю чтобы мечты сбывались, а сердце было наполнено любовью! 🌺✨`,
      [GreetingStyle.ROMANTIC]: `💕 Дорогой(ая) ${recipientName}! В этот волшебный день ${holiday} хочу пожелать тебе бесконечного счастья, нежности и тепла! Пусть каждый миг будет наполнен любовью, а в глазах всегда горит огонь страсти! Обнимаю крепко! 💝`
    };

    return fallbackTexts[style] || fallbackTexts[GreetingStyle.FRIENDLY];
  }

  /**
   * Получение заглушки для текста поздравления (public)
   */
  getFallbackGreetingTextPublic(holidayData: HolidayPromptData): string {
    return this.getFallbackGreetingText(holidayData);
  }

  /**
   * Получение промпта по умолчанию для генерации изображения (public)
   */
  getFallbackPromptPublic(imageData: HolidayImageData): string {
    return this.getDefaultPrompt(imageData);
  }

  /**
   * Проверка доступности AI сервисов
   */
  async checkAiAvailability(): Promise<{ ai: boolean; image: boolean }> {
    try {
      const groqKey = this.configService.get<string>('GROQ_API_KEY');
      const geminiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
      
      return {
        ai: !!(groqKey || geminiKey),
        image: !!groqKey // Groq используется для промптов изображений
      };
    } catch (error) {
      this.logger.error('Ошибка проверки доступности AI:', error);
      return { ai: false, image: false };
    }
  }

  /**
   * Проверка доступности AI (public alias)
   */
  async isAiAvailable(): Promise<boolean> {
    const availability = await this.checkAiAvailability();
    return availability.ai;
  }

  /**
   * Получение статистики использования AI
   */
  getAiStats() {
    return this.aiOrchestrationService.getUsageStats();
  }

  /**
   * Сброс дневных лимитов
   */
  resetDailyLimits() {
    this.aiOrchestrationService.resetDailyLimits();
  }

  /**
   * Очистка кэша промптов
   */
  clearPromptCache() {
    return this.groqService.clearPromptCache();
  }
}
