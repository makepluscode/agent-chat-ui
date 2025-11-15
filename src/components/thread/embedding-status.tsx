"use client";

import { CheckCircle2, Loader2, FileText, Database, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmbeddingStep {
  id: string;
  label: string;
  status: "pending" | "processing" | "completed" | "error";
  details?: string;
}

interface EmbeddingStatusProps {
  steps: EmbeddingStep[];
  currentStep?: string;
}

export function EmbeddingStatus({ steps, currentStep }: EmbeddingStatusProps) {
  return (
    <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4" />
        <span>PDF Embedding Process</span>
      </div>
      <div className="space-y-2">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.status === "completed";
          const isProcessing = step.status === "processing";
          const isError = step.status === "error";

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 text-sm",
                isActive && "text-foreground",
                !isActive && !isCompleted && "text-muted-foreground"
              )}
            >
              <div className="mt-0.5">
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : isError ? (
                  <div className="h-4 w-4 rounded-full bg-red-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium">{step.label}</div>
                {step.details && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {step.details}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper to parse embedding status from message content
export function parseEmbeddingStatus(content: string): EmbeddingStep[] {
  const steps: EmbeddingStep[] = [];
  
  // Check if content contains embedding-related keywords
  const hasEmbeddingInfo = 
    content.includes("embedding") ||
    content.includes("vector") ||
    content.includes("임베딩") || 
    content.includes("벡터") ||
    content.includes("PDF parsing") ||
    content.includes("PDF 파싱");

  if (!hasEmbeddingInfo) {
    return steps;
  }

  // Extract information from markdown content (support both English and Korean)
  const embeddingModelMatch = content.match(/(?:임베딩 모델|Embedding model|Model)[:\s*]+([^\n]+)/i);
  const chunksMatch = content.match(/(?:생성된 청크|Chunks created|Generated chunks)[:\s*]+(\d+)/i);
  const storedMatch = content.match(/(?:저장된 청크|Stored chunks|Chunks stored)[:\s*]+(\d+)/i);
  const pagesMatch = content.match(/(?:총 페이지|Total pages|Pages)[:\s*]+(\d+)/i);
  const embeddingCountMatch = content.match(/(?:생성된 임베딩|Embeddings generated|Generated embeddings)[:\s*]+(\d+)/i);
  const embeddingDimMatch = content.match(/(?:임베딩 차원|Embedding dimension|Dimension)[:\s*]+(\d+)/i);

  // Determine status based on content
  const isCompleted = content.includes("✅") || content.includes("완료") || content.includes("성공") || 
                      content.includes("Complete") || content.includes("Success");
  const isProcessing = content.includes("진행 중") || content.includes("처리 중") || 
                       content.includes("Processing") || content.includes("In progress");

  if (isCompleted) {
    steps.push({
      id: "extract",
      label: "PDF Text Extraction",
      status: "completed",
      details: pagesMatch ? `Extracted text from ${pagesMatch[1]} pages` : undefined,
    });
    steps.push({
      id: "chunk",
      label: "Text Chunking",
      status: "completed",
      details: chunksMatch ? `Created ${chunksMatch[1]} chunks` : undefined,
    });
    steps.push({
      id: "embed",
      label: "Embedding Generation",
      status: "completed",
      details: embeddingCountMatch && embeddingDimMatch
        ? `${embeddingCountMatch[1]} embeddings (${embeddingDimMatch[1]} dimensions)`
        : embeddingModelMatch 
          ? `${embeddingModelMatch[1].trim()}` 
          : "BGE-M3 model",
    });
    steps.push({
      id: "store",
      label: "Vector Storage",
      status: "completed",
      details: storedMatch ? `${storedMatch[1]} chunks stored in ChromaDB` : undefined,
    });
  } else if (isProcessing) {
    steps.push({
      id: "extract",
      label: "PDF Text Extraction",
      status: "processing",
    });
    steps.push({
      id: "chunk",
      label: "Text Chunking",
      status: "pending",
    });
    steps.push({
      id: "embed",
      label: "Embedding Generation",
      status: "pending",
    });
    steps.push({
      id: "store",
      label: "Vector Storage",
      status: "pending",
    });
  }

  return steps;
}
