export interface AITelemetryOptions {
    functionId?: string;
    metadata?: Record<string, any>;
    recordInputs?: boolean;
    recordOutputs?: boolean;
}

// Utility function to enhance AI SDK calls with telemetry
export function withAITelemetry<T extends Record<string, any>>(
    config: T,
    options?: AITelemetryOptions,
): T & {
    experimental_telemetry: {
        isEnabled: boolean;
        functionId?: string;
        metadata?: Record<string, any>;
        recordInputs?: boolean;
        recordOutputs?: boolean;
    };
} {
    return {
        ...config,
        experimental_telemetry: {
            isEnabled: true,
            functionId: options?.functionId,
            metadata: options?.metadata,
            recordInputs: options?.recordInputs ?? true,
            recordOutputs: options?.recordOutputs ?? true,
        },
    };
}
