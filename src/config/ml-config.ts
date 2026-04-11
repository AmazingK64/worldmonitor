/**
 * ML Configuration for ONNX Runtime Web integration
 * Models are loaded from HuggingFace CDN via @xenova/transformers
 */

export interface ModelConfig {
  id: string;
  name: string;
  hfModel: string;
  size: number;
  priority: number;
  required: boolean;
  task: 'feature-extraction' | 'text-classification' | 'text2text-generation' | 'token-classification';
}

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: 'embeddings',
    name: 'all-MiniLM-L6-v2',
    hfModel: 'Xenova/all-MiniLM-L6-v2',
    size: 23_000_000,
    priority: 1,
    required: true,
    task: 'feature-extraction',
  },
  {
    id: 'sentiment',
    name: 'DistilBERT-SST2',
    hfModel: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    size: 65_000_000,
    priority: 2,
    required: false,
    task: 'text-classification',
  },
  {
    id: 'summarization',
    name: 'Flan-T5-base',
    hfModel: 'Xenova/flan-t5-base',
    size: 250_000_000,
    priority: 3,
    required: false,
    task: 'text2text-generation',
  },
  {
    id: 'summarization-beta',
    name: 'Flan-T5-small',
    hfModel: 'Xenova/flan-t5-small',
    size: 60_000_000,
    priority: 3,
    required: false,
    task: 'text2text-generation',
  },
  {
    id: 'summarization-multilingual',
    name: 'mT5-XLSum-multilingual',
    // NOTE: This model requires ONNX conversion before it can be used in the browser.
    // Run `python scripts/convert-xlsum-onnx.py --quantize int8 --upload <your-hf-username>/mt5-xlsum-onnx`
    // Then update this hfModel to your uploaded repo ID.
    // The original PyTorch model at `csebuetnlp/mT5_multilingual_XLSum` cannot be loaded
    // directly by @xenova/transformers — it needs ONNX weights.
    hfModel: 'csebuetnlp/mT5_multilingual_XLSum',
    size: 300_000_000,
    priority: 3,
    required: false,
    task: 'text2text-generation',
  },
  {
    id: 'ner',
    name: 'BERT-NER',
    hfModel: 'Xenova/bert-base-NER',
    size: 65_000_000,
    priority: 4,
    required: false,
    task: 'token-classification',
  },
];

/**
 * Languages that require the multilingual summarization model
 * instead of the English-only Flan-T5.
 */
export const MULTILINGUAL_SUMMARY_LANGS = new Set([
  'zh', // Chinese
  'ja', // Japanese
  'ko', // Korean
  'ar', // Arabic
  'ru', // Russian
  'hi', // Hindi
  'bn', // Bengali
  'th', // Thai
  'vi', // Vietnamese
  'id', // Indonesian
  'ms', // Malay
  'tr', // Turkish
  'fa', // Persian
  'he', // Hebrew
  'uk', // Ukrainian
]);

/**
 * Return the best summarization model ID for the given UI language.
 * Multilingual languages use the mT5-XLSum model; others use Flan-T5.
 */
export function getSummarizationModelId(lang: string): string {
  if (MULTILINGUAL_SUMMARY_LANGS.has(lang)) {
    return 'summarization-multilingual';
  }
  return 'summarization-beta';
}

export const ML_FEATURE_FLAGS = {
  semanticClustering: true,
  mlSentiment: true,
  summarization: true,
  mlNER: true,
  insightsPanel: true,
};

export const ML_THRESHOLDS = {
  semanticClusterThreshold: 0.75,
  minClustersForML: 5,
  maxTextsPerBatch: 20,
  modelLoadTimeoutMs: 600_000,
  inferenceTimeoutMs: 120_000,
  memoryBudgetMB: 200,
};

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_CONFIGS.find(m => m.id === modelId);
}

export function getRequiredModels(): ModelConfig[] {
  return MODEL_CONFIGS.filter(m => m.required);
}

export function getModelsByPriority(): ModelConfig[] {
  return [...MODEL_CONFIGS].sort((a, b) => a.priority - b.priority);
}
