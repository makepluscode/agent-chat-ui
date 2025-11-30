export interface RAGSourceMetadata {
  totalPages: number;
  totalChars: number;
  chunkCount: number;
  avgChunkSize: number;
  embeddingModel: string;
  embeddingsGenerated: number;
  pageTexts?: Array<{
    page: number;
    text: string;
    charCount: number;
  }>;
}

export interface RAGSource {
  id: string;
  filename: string;
  file: File;
  isActive: boolean; // 체크박스 상태
  metadata?: RAGSourceMetadata;
  uploadedAt: Date;
}

