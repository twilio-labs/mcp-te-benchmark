declare const Chart: any;
interface Session {
    taskId: number;
    directoryId: string;
    mode: string;
    model: string;
    mcpServer?: string;
    mcpClient?: string;
    startTime: number;
    endTime: number;
    duration: number;
    apiCalls: number;
    interactions: number;
    tokensIn: number;
    tokensOut: number;
    totalTokens?: number;
    cacheWrites?: number;
    cacheReads?: number;
    conversationHistoryIndex?: number;
    cost: number;
    success: boolean;
    notes?: string;
}
interface MetricValue {
    control: number;
    mcp: number;
    unit: string;
}
interface MetricsMap {
    [key: string]: MetricValue;
}
interface TaskData {
    [taskId: string]: {
        control: Session[];
        mcp: Session[];
    };
}
interface ChartMap {
    [key: string]: any;
}
interface MetricAverages {
    duration: number;
    apiCalls: number;
    interactions: number;
    tokens: number;
    cacheWrites: number;
    cacheReads: number;
    convHistoryIndex: number;
    cost: number;
}
declare let allSessions: Session[];
declare let filteredSessions: Session[];
declare let charts: ChartMap;
declare function loadData(): Promise<void>;
declare function populateFilter(selectElement: HTMLSelectElement, options: string[]): void;
declare function filterData(): void;
declare function displayMetrics(): void;
declare function displayModelMetrics(): void;
declare function displaySessions(): void;
declare function initCharts(): void;
declare function updateCharts(): void;
declare function updateComparisonChart(metric: string): void;
declare function downloadCsv(): void;
declare function average(values: number[]): number;
declare function percentage(part: number, total: number): number;
declare function percentageChange(newValue: number, oldValue: number): string;
