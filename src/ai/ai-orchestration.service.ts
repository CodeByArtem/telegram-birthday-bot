import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroqService } from './groq.service';
import { GreetingStyle, GreetingLanguage, HolidayPromptData } from './ai.service';

export interface AIProvider {
  name: string;
  priority: number;
  dailyLimit: number;
  currentUsage: number;
  isAvailable: boolean;
  reasoning?: string;
  generateText(prompt: string, options: any): Promise<string>;
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
    // Groq - высокий приоритет, большой лимит
    this.providers.set('groq', {
      name: 'groq',
      priority: 1,
      dailyLimit: 14400,
      currentUsage: 0,
      isAvailable: !!this.configService.get<string>('GROQ_API_KEY'),
      generateText: this.generateWithGroq.bind(this)
    });

    // Gemini - средний приоритет, маленький лимит
    this.providers.set('gemini', {
      name: 'gemini',
      priority: 2,
      dailyLimit: 20,
      currentUsage: 0,
      isAvailable: !!this.configService.get<string>('GOOGLE_GEMINI_API_KEY'),
      generateText: this.generateWithGemini.bind(this)
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
        // 1. Приоритет
        // 2. Текущая загрузка (usage/limit)
        // 3. Последнее использование
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
      // Помечаем провайдер как недоступный при ошибке
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        provider.isAvailable = false;
        this.logger.warn(`🚫 Провайдер ${providerName} превысил лимит, отключен до следующего дня`);
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
   * Генерация через Gemini (заглушка, будет реализована позже)
   */
  private async generateWithGemini(prompt: string, options: AIOrchestrationOptions): Promise<string> {
    // Здесь будет логика Gemini, но пока возвращаем ошибку
    throw new Error('Gemini временно отключен в пользу Groq');
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
}
