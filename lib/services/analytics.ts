// Global Umami interface extension
declare global {
  interface Window {
    umami?: {
      track: (event?: string, data?: Record<string, any>) => void;
      identify: (data?: Record<string, any>) => void;
      identify: (id: string, data?: Record<string, any>) => void;
    };
  }
}

// Type definitions for common analytics events
export interface AIEventData {
  promptLength?: number;
  promptWords?: number;
  responseLength?: number;
  responseWords?: number;
  errorType?: string;
  model?: string;
  messageLength?: number;
  conversationLength?: number;
  clearedMessageCount?: number;
  queryLength?: number;
  provider?: string;
  resultCount?: number;
}

export interface FileEventData {
  fileType?: string;
  fileSize?: number;
  fileName?: string;
  fileCount?: number;
  totalSize?: number;
  fileTypes?: string[];
  uploadType?: string;
  method?: string;
  errorMessage?: string;
}

export interface UIEventData {
  page?: string;
  section?: string;
  element?: string;
  action?: string;
  [key: string]: any;
}

/**
 * Simple, reusable Umami analytics service
 * Eliminates repetitive window.umami checks and provides type-safe tracking
 */
class AnalyticsService {
  private isEnabled(): boolean {
    return typeof window !== 'undefined' && !!window.umami;
  }

  /**
   * Core tracking method - tracks any event with optional data
   */
  track(event: string, data?: Record<string, any>): void {
    if (!this.isEnabled()) return;

    try {
      window.umami!.track(event, data);
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }

  /**
   * Track page views manually
   */
  pageView(url?: string, title?: string): void {
    if (!this.isEnabled()) return;

    try {
      window.umami!.track();
    } catch (error) {
      console.warn('Page view tracking failed:', error);
    }
  }

  /**
   * User identification
   */
  identify(id?: string, data?: Record<string, any>): void {
    if (!this.isEnabled()) return;

    try {
      if (id) {
        window.umami!.identify(id, data);
      } else if (data) {
        window.umami!.identify(data);
      }
    } catch (error) {
      console.warn('User identification failed:', error);
    }
  }

  // AI-specific tracking methods
  ai = {
    generateText: {
      submit: (data: Pick<AIEventData, 'promptLength' | 'promptWords'>) => {
        this.track('generate-text-submit', data);
      },
      success: (data: Pick<AIEventData, 'responseLength' | 'responseWords'>) => {
        this.track('generate-text-success', data);
      },
      error: (data: Pick<AIEventData, 'errorType'>) => {
        this.track('generate-text-error', data);
      },
    },

    generateImage: {
      submit: (data: Pick<AIEventData, 'promptLength' | 'promptWords'>) => {
        this.track('generate-image-submit', data);
      },
      success: (data?: Pick<AIEventData, 'model'>) => {
        this.track('generate-image-success', data);
      },
      error: (data: Pick<AIEventData, 'errorType'>) => {
        this.track('generate-image-error', data);
      },
    },

    chat: {
      send: (data: Pick<AIEventData, 'messageLength' | 'conversationLength'>) => {
        this.track('chat-message-send', data);
      },
      success: (data: Pick<AIEventData, 'responseLength' | 'conversationLength'>) => {
        this.track('chat-response-received', data);
      },
      error: (data: Pick<AIEventData, 'errorType'>) => {
        this.track('chat-error', data);
      },
      clear: (data: Pick<AIEventData, 'clearedMessageCount'>) => {
        this.track('chat-conversation-cleared', data);
      },
    },

    webSearch: {
      submit: (data: Pick<AIEventData, 'queryLength' | 'provider'>) => {
        this.track('web-search-submit', data);
      },
      success: (data: Pick<AIEventData, 'resultCount' | 'provider'>) => {
        this.track('web-search-success', data);
      },
      error: (data: Pick<AIEventData, 'errorType' | 'provider'>) => {
        this.track('web-search-error', data);
      },
    },
  };

  // File-specific tracking methods
  file = {
    upload: {
      success: (
        data: Pick<FileEventData, 'uploadType' | 'fileCount' | 'totalSize' | 'fileTypes'>,
      ) => {
        this.track('file-upload-success', data);
      },
      error: (data: Pick<FileEventData, 'uploadType' | 'errorMessage'>) => {
        this.track('file-upload-error', data);
      },
    },

    download: (data: Pick<FileEventData, 'fileType' | 'fileSize'>) => {
      this.track('file-download', {
        action: 'download',
        file_type: data.fileType?.split('/')[0],
        file_size: data.fileSize,
      });
    },

    view: (data: Pick<FileEventData, 'fileType'>) => {
      this.track('file-view', {
        action: 'view',
        file_type: data.fileType?.split('/')[0],
      });
    },

    delete: (data?: Pick<FileEventData, 'fileName'>) => {
      this.track('file-delete', {
        action: 'delete',
        ...(data?.fileName && { file_key: data.fileName }),
      });
    },

    clearAll: (data: Pick<FileEventData, 'fileCount'>) => {
      this.track('files-clear-all', {
        cleared_count: data.fileCount,
      });
    },
  };

  // UI interaction tracking methods
  ui = {
    click: (element: string, data?: UIEventData) => {
      this.track(`${element}-click`, data);
    },

    docsLink: (data: Pick<UIEventData, 'page' | 'section'>) => {
      this.track('docs-link-click', data);
    },

    examplePrompt: (data: { promptIndex: number; promptType: string }) => {
      this.track('example-prompt-click', {
        prompt_index: data.promptIndex,
        prompt_type: data.promptType,
      });
    },

    settingChange: (setting: string, value: any) => {
      this.track(`setting-${setting}-change`, { value });
    },

    uploadMethodChange: (method: string) => {
      this.track('upload-method-change', { method });
    },
  };

  // Utility methods for common patterns
  utils = {
    /**
     * Track image downloads with standard format
     */
    imageDownload: (format = 'png') => {
      this.track('image-download', {
        action: 'download',
        format,
      });
    },

    /**
     * Track errors with context
     */
    error: (error: Error | string, context?: string) => {
      this.track('app-error', {
        error_message: typeof error === 'string' ? error : error.message,
        context,
      });
    },

    /**
     * Track timing/performance metrics
     */
    timing: (name: string, duration: number, category?: string) => {
      this.track('performance-timing', {
        name,
        duration,
        category,
      });
    },
  };
}

// Export singleton instance
export const analytics = new AnalyticsService();

// Export service class for testing or multiple instances
export { AnalyticsService };
