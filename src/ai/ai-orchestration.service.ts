import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroqService } from './groq.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GreetingStyle, GreetingLanguage, HolidayPromptData } from './ai.service';

export interface AIProvider {
  name: string;
  priority: number;
  dailyLimit: number;
  currentUsage: number;
  isAvailable: boolean;
  reasoning?: string;
  generateText(prompt: string, options: any): Promise<string>;
  generateImagePrompt?(holiday: string, style: string, language: string): Promise<string>;
}

export interface AIOrchestrationOptions {
  style?: GreetingStyle;
  language?: GreetingLanguage;
  maxRetries?: number;
  timeout?: number;
  recipientName?: string;
  holiday?: string;
}

@Injectable()
export class AiOrchestrationService {
  private readonly logger = new Logger(AiOrchestrationService.name);
  private providers: Map<string, AIProvider> = new Map();
  private usageStats = new Map<string, { success: number; failed: number; lastUsed: Date }>();

  constructor(
    private configService: ConfigService,
    private groqService: GroqService
  ) {
    this.initializeProviders();
  }

  /**
   * Инициализация провайдеров AI
   */
  private initializeProviders() {
    // Groq - высокий приоритет, основной провайдер
    this.providers.set('groq', {
      name: 'groq',
      priority: 1,
      dailyLimit: 14400,
      currentUsage: 0,
      isAvailable: !!this.configService.get<string>('GROQ_API_KEY'),
      generateText: this.generateWithGroq.bind(this),
      generateImagePrompt: this.generateImagePromptWithGroq.bind(this)
    });

    // Gemini - низкий приоритет, запасной провайдер
    this.providers.set('gemini', {
      name: 'gemini',
      priority: 2,
      dailyLimit: 20,
      currentUsage: 0,
      isAvailable: !!this.configService.get<string>('GOOGLE_GEMINI_API_KEY'),
      generateText: this.generateWithGemini.bind(this),
      generateImagePrompt: this.generateImagePromptWithGemini.bind(this)
    });
  }

  /**
   * Умная генерация текста с выбором лучшей модели
   */
  async generateGreetingText(
    holidayData: HolidayPromptData,
    options: AIOrchestrationOptions = {}
  ): Promise<{ text: string; provider: string; reasoning: string }> {
    const startTime = Date.now();
    
    try {
      // 1. Анализируем задачу
      const taskAnalysis = this.analyzeTask(holidayData, options);
      this.logger.log(`🧠 Анализ задачи: ${taskAnalysis.reasoning}`);

      // 2. Выбираем лучшую модель
      const selectedProvider = this.selectBestProvider(taskAnalysis);
      this.logger.log(`🎯 Выбрана модель: ${selectedProvider.name} (${selectedProvider.reasoning})`);

      // 3. Генерируем текст
      const result = await this.generateWithProvider(selectedProvider.name, holidayData, options);
      
      // 4. Обновляем статистику
      this.updateUsageStats(selectedProvider.name, true, Date.now() - startTime);
      
      return {
        text: result,
        provider: selectedProvider.name,
        reasoning: selectedProvider.reasoning
      };

    } catch (error) {
      this.logger.error('❌ Все провайдеры недоступны, используем fallback');
      this.updateUsageStats('fallback', true, Date.now() - startTime);
      
      return {
        text: this.getFallbackText(holidayData),
        provider: 'fallback',
        reasoning: 'Все AI провайдеры недоступны'
      };
    }
  }

  /**
   * Умная генерация промпта для изображения
   */
  async generateImagePrompt(
    holiday: string,
    style: string = 'friendly',
    language: string = 'russian'
  ): Promise<{ prompt: string; provider: string; reasoning: string }> {
    const startTime = Date.now();
    
    try {
      // 1. Пробуем Groq (основной провайдер)
      const groqProvider = this.providers.get('groq');
      if (groqProvider?.isAvailable && groqProvider.generateImagePrompt) {
        try {
          const prompt = await groqProvider.generateImagePrompt(holiday, style, language);
          this.updateUsageStats('groq', true, Date.now() - startTime);
          
          return {
            prompt,
            provider: 'groq',
            reasoning: 'Основной провайдер, кэшированные промпты'
          };
        } catch (error) {
          this.logger.warn('❌ Groq не смог сгенерировать промпт:', error.message);
        }
      }

      // 2. Fallback на статичные промпты
      this.updateUsageStats('fallback', true, Date.now() - startTime);
      const fallbackPrompt = this.getStaticImagePrompt(holiday, style);
      
      return {
        prompt: fallbackPrompt,
        provider: 'fallback',
        reasoning: 'Groq недоступен, использован статичный промпт'
      };

    } catch (error) {
      this.logger.error('❌ Ошибка генерации промпта:', error.message);
      this.updateUsageStats('error', true, Date.now() - startTime);
      
      return {
        prompt: this.getStaticImagePrompt(holiday),
        provider: 'error',
        reasoning: 'Все методы недоступны'
      };
    }
  }

  /**
   * Анализ задачи для выбора оптимальной модели
   */
  private analyzeTask(holidayData: HolidayPromptData, options: AIOrchestrationOptions) {
    const complexity = this.assessComplexity(holidayData);
    const language = options.language || GreetingLanguage.RUSSIAN;
    const style = options.style || GreetingStyle.FRIENDLY;
    
    return {
      complexity,
      language,
      style,
      reasoning: `Сложность: ${complexity}, Язык: ${language}, Стиль: ${style}`
    };
  }

  /**
   * Оценка сложности задачи
   */
  private assessComplexity(holidayData: HolidayPromptData): 'simple' | 'medium' | 'complex' {
    if (holidayData.customPrompt) return 'complex';
    if (holidayData.recipientInfo?.interests?.length > 2) return 'medium';
    return 'simple';
  }

  /**
   * Умный выбор провайдера на основе множества факторов
   */
  private selectBestProvider(taskAnalysis: any): AIProvider {
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.isAvailable)
      .sort((a, b) => {
        // Факторы выбора:
        // 1. Приоритет (Groq первый, Gemini второй)
        // 2. Текущая загрузка (usage/limit)
        const aLoadRatio = a.currentUsage / a.dailyLimit;
        const bLoadRatio = b.currentUsage / b.dailyLimit;
        
        // Предпочитаем менее загруженные
        if (aLoadRatio < 0.8 && bLoadRatio > 0.8) return -1;
        if (aLoadRatio > 0.8 && bLoadRatio < 0.8) return 1;
        
        // Если загрузка схожая, используем приоритет
        return a.priority - b.priority;
      });

    if (availableProviders.length === 0) {
      throw new Error('Нет доступных AI провайдеров');
    }

    const selected = availableProviders[0];
    const loadRatio = selected.currentUsage / selected.dailyLimit;
    
    return {
      ...selected,
      reasoning: `Приоритет: ${selected.priority}, Загрузка: ${Math.round(loadRatio * 100)}%, Лимит: ${selected.dailyLimit}`
    };
  }

  /**
   * Генерация с конкретным провайдером
   */
  private async generateWithProvider(
    providerName: string,
    holidayData: HolidayPromptData,
    options: AIOrchestrationOptions
  ): Promise<string> {
    const provider = this.providers.get(providerName);
    if (!provider || !provider.isAvailable) {
      throw new Error(`Провайдер ${providerName} недоступен`);
    }

    try {
      const prompt = this.buildPrompt(holidayData, options);
      
      // Передаем дополнительные параметры в options
      const generateOptions = {
        ...options,
        recipientName: holidayData.recipientName,
        holiday: holidayData.name
      };
      
      const result = await provider.generateText(prompt, generateOptions);
      
      // Увеличиваем счетчик использования
      provider.currentUsage++;
      
      return result;
    } catch (error) {
      // Обработка 429 ошибки с retry логикой
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        // Извлекаем retryDelay из ответа
        const retryDelay = this.extractRetryDelay(error.message);
        
        if (retryDelay && providerName === 'gemini') {
          this.logger.warn(`🚫 ${providerName} превысил лимит, повтор через ${retryDelay}с`);
          
          // Ждем и пробуем еще раз
          await this.sleep(retryDelay * 1000);
          
          // Вторая попытка
          try {
            const prompt = this.buildPrompt(holidayData, options);
            const generateOptions = {
              ...options,
              recipientName: holidayData.recipientName,
              holiday: holidayData.name
            };
            const result = await provider.generateText(prompt, generateOptions);
            provider.currentUsage++;
            return result;
          } catch (retryError) {
            // Если и вторая попытка не удалась, отключаем провайдер
            provider.isAvailable = false;
            this.logger.warn(`🚫 ${providerName} полностью недоступен до следующего дня`);
            throw retryError;
          }
        } else {
          provider.isAvailable = false;
          this.logger.warn(`🚫 Провайдер ${providerName} превысил лимит, отключен до следующего дня`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Генерация через Groq
   */
  private async generateWithGroq(prompt: string, options: AIOrchestrationOptions): Promise<string> {
    const recipientName = options.recipientName || 'друг';
    const holiday = options.holiday || 'праздник';
    const style = options.style || GreetingStyle.FRIENDLY;
    
    return await this.groqService.generateGreetingText(
      recipientName,
      holiday,
      style,
      options.language || GreetingLanguage.RUSSIAN
    );
  }

  /**
   * Генерация промпта через Groq
   */
  private async generateImagePromptWithGroq(
    holiday: string,
    style: string,
    language: string
  ): Promise<string> {
    return await this.groqService.generateImagePrompt(holiday, style, language);
  }

  /**
   * Генерация через Gemini (с retry логикой)
   */
  private async generateWithGemini(prompt: string, options: AIOrchestrationOptions): Promise<string> {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini API ключ не настроен');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
      { model: 'gemini-2.5-flash' },
      { apiVersion: 'v1beta' }
    );

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  /**
   * Генерация промпта через Gemini
   */
  private async generateImagePromptWithGemini(
    holiday: string,
    style: string,
    language: string
  ): Promise<string> {
    // Заглушка - Gemini не используется для промптов
    throw new Error('Gemini не используется для генерации промптов изображений');
  }

  /**
   * Извлечение retry delay из ошибки
   */
  private extractRetryDelay(errorMessage: string): number | null {
    const match = errorMessage.match(/Please retry in ([\d.]+)s/);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Функция задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Построение умного промпта
   */
  private buildPrompt(holidayData: HolidayPromptData, options: AIOrchestrationOptions): string {
    let basePrompt = `Напиши поздравление с ${holidayData.name}`;
    
    if (holidayData.recipientName) {
      basePrompt += ` для ${holidayData.recipientName}`;
    }
    
    if (holidayData.customPrompt) {
      basePrompt += `. ${holidayData.customPrompt}`;
    }
    
    return basePrompt;
  }

  /**
   * Статичный промпт для изображения (fallback)
   */
  private getStaticImagePrompt(holiday: string, style: string = 'friendly'): string {
    const staticPrompts = {
      'День рождения': {
        friendly: 'festive birthday celebration, colorful balloons, cake, gifts, warm lighting, professional photography, high quality, detailed',
        official: 'elegant birthday celebration, formal setting, sophisticated decorations, premium photography style',
        funny: 'fun birthday party, colorful confetti, playful atmosphere, vibrant colors, joyful mood',
        poetic: 'romantic birthday scene, soft lighting, beautiful flowers, dreamy atmosphere, artistic style',
        romantic: 'intimate birthday celebration, candlelight, roses, warm ambiance, romantic photography'
      },
      '8 марта': {
        friendly: 'international women day celebration, spring flowers, pink and white colors, fresh bouquet, professional photography',
        official: 'formal women day celebration, elegant flowers, sophisticated arrangement, corporate style',
        funny: 'colorful women day party, bright spring colors, festive atmosphere, joyful celebration',
        poetic: 'beautiful spring scene, blooming flowers, soft pastel colors, dreamy women day atmosphere',
        romantic: 'romantic women day setting, red roses, candlelight, intimate celebration, elegant style'
      },
      'Новый год': {
        friendly: 'festive new year celebration, christmas tree, fireworks, snow, warm lights, holiday atmosphere',
        official: 'elegant new year celebration, sophisticated decorations, formal setting, premium style',
        funny: 'fun new year party, colorful decorations, festive atmosphere, joyful celebration',
        poetic: 'magical new year scene, snowflakes, winter wonderland, dreamy holiday atmosphere',
        romantic: 'romantic new year celebration, candlelight, intimate setting, warm holiday ambiance'
      }
    };

    return staticPrompts[holiday]?.[style] || staticPrompts[holiday]?.friendly || 'festive celebration, colorful design, high quality';
  }

  /**
   * Fallback текст
   */
  private getFallbackText(holidayData: HolidayPromptData): string {
    const recipientName = holidayData.recipientName || 'друг';
    const holiday = holidayData.name || 'праздник';
    
    return `🎉 Поздравляю с ${holiday}, ${recipientName}! Желаю счастья, здоровья и удачи! ✨`;
  }

  /**
   * Обновление статистики использования
   */
  private updateUsageStats(provider: string, success: boolean, responseTime: number) {
    const current = this.usageStats.get(provider) || { success: 0, failed: 0, lastUsed: new Date() };
    
    if (success) {
      current.success++;
    } else {
      current.failed++;
    }
    
    current.lastUsed = new Date();
    this.usageStats.set(provider, current);
  }

  /**
   * Получение статистики использования
   */
  getUsageStats() {
    const stats = {
      providers: Array.from(this.providers.values()).map(p => ({
        name: p.name,
        priority: p.priority,
        dailyLimit: p.dailyLimit,
        currentUsage: p.currentUsage,
        isAvailable: p.isAvailable,
        usagePercentage: Math.round((p.currentUsage / p.dailyLimit) * 100)
      })),
      usageStats: Object.fromEntries(this.usageStats),
      summary: {
        totalProviders: this.providers.size,
        availableProviders: Array.from(this.providers.values()).filter(p => p.isAvailable).length,
        totalRequests: Array.from(this.usageStats.values()).reduce((sum, stat) => sum + stat.success + stat.failed, 0)
      }
    };

    this.logger.log(`📊 Статистика AI: ${stats.summary.availableProviders}/${stats.summary.totalProviders} провайдеров доступны`);
    return stats;
  }

  /**
   * Сброс дневных лимитов (крон задача)
   */
  resetDailyLimits() {
    this.providers.forEach(provider => {
      provider.currentUsage = 0;
      provider.isAvailable = !!this.configService.get<string>(`GROQ_API_KEY`) || 
                           !!this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    });
    
    this.logger.log('🔄 Дневные лимиты AI провайдеров сброшены');
  }

  /**
   * Предсказание истечения лимитов
   */
  predictLimitExhaustion() {
    const predictions = [];
    
    this.providers.forEach(provider => {
      const stats = this.usageStats.get(provider.name);
      if (stats && stats.success > 0) {
        const hoursSinceLastUse = (Date.now() - stats.lastUsed.getTime()) / (1000 * 60 * 60);
        const usageRate = stats.success / Math.max(hoursSinceLastUse, 1);
        const remainingRequests = provider.dailyLimit - provider.currentUsage;
        const hoursUntilExhaustion = remainingRequests / Math.max(usageRate, 0.1);
        
        predictions.push({
          provider: provider.name,
          remainingRequests,
          hoursUntilExhaustion: Math.round(hoursUntilExhaustion),
          exhaustionDate: new Date(Date.now() + hoursUntilExhaustion * 60 * 60 * 1000)
        });
      }
    });
    
    return predictions.sort((a, b) => a.hoursUntilExhaustion - b.hoursUntilExhaustion);
  }

  /**
   * Получение статистики кэша промптов
   */
  getPromptCacheStats() {
    const groqProvider = this.providers.get('groq');
    if (groqProvider && 'getPromptCacheStats' in this.groqService) {
      return (this.groqService as any).getPromptCacheStats();
    }
    return { size: 0, keys: [] };
  }
}
