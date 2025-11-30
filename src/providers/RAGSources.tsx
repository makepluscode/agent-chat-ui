"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { RAGSource, RAGSourceMetadata } from "@/types/rag-source";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "rag-sources";

// 로컬 스토리지에서 소스 로드
function loadSourcesFromStorage(): RAGSource[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return parsed.map((source: any) => ({
      ...source,
      file: new File([], source.filename, { type: "application/pdf" }), // File 객체는 복원 불가능하므로 빈 파일로 대체
      uploadedAt: source.uploadedAt ? new Date(source.uploadedAt) : new Date(),
    }));
  } catch (error) {
    console.error("Failed to load RAG sources from storage:", error);
    return [];
  }
}

// 로컬 스토리지에 소스 저장
function saveSourcesToStorage(sources: RAGSource[]): void {
  if (typeof window === "undefined") return;
  
  try {
    // File 객체와 Date 객체는 직렬화할 수 없으므로 제외하고 저장
    const serializable = sources.map(({ file, uploadedAt, ...rest }) => ({
      ...rest,
      uploadedAt: uploadedAt ? uploadedAt.toISOString() : new Date().toISOString(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.error("Failed to save RAG sources to storage:", error);
  }
}

interface RAGSourcesContextType {
  sources: RAGSource[];
  isLoading: boolean;
  addSource: (file: File, metadata?: RAGSourceMetadata) => string;
  removeSource: (id: string) => void;
  toggleSourceActive: (id: string) => void;
  updateSourceMetadata: (id: string, metadata: RAGSourceMetadata) => void;
  getActiveSources: () => RAGSource[];
  getActiveFilenames: () => string[];
  clearAllSources: () => void;
}

const RAGSourcesContext = createContext<RAGSourcesContextType | undefined>(undefined);

export function RAGSourcesProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<RAGSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 초기 로드 - localStorage에서 소스 로드
  useEffect(() => {
    setIsLoading(true);
    const loaded = loadSourcesFromStorage();
    setSources(loaded);
    setIsLoading(false);
  }, []);

  // 소스 추가
  const addSource = useCallback((file: File, metadata?: RAGSourceMetadata) => {
    const newSource: RAGSource = {
      id: uuidv4(),
      filename: file.name,
      file,
      isActive: true,
      metadata,
      uploadedAt: new Date(),
    };

    setSources((prev) => {
      const updated = [...prev, newSource];
      try {
        saveSourcesToStorage(updated);
      } catch (error) {
        console.error("Failed to save source to storage:", error);
      }
      return updated;
    });

    return newSource.id;
  }, []);

  // 소스 제거
  const removeSource = useCallback((id: string) => {
    setSources((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        saveSourcesToStorage(updated);
      } catch (error) {
        console.error("Failed to save after removing source:", error);
      }
      return updated;
    });
  }, []);

  // 소스 활성화/비활성화 토글
  const toggleSourceActive = useCallback((id: string) => {
    setSources((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, isActive: !s.isActive } : s
      );
      try {
        saveSourcesToStorage(updated);
      } catch (error) {
        console.error("Failed to save after toggling source:", error);
      }
      return updated;
    });
  }, []);

  // 소스 메타데이터 업데이트
  const updateSourceMetadata = useCallback(
    (id: string, metadata: RAGSourceMetadata) => {
      setSources((prev) => {
        const updated = prev.map((s) =>
          s.id === id ? { ...s, metadata } : s
        );
        try {
          saveSourcesToStorage(updated);
        } catch (error) {
          console.error("Failed to save after updating metadata:", error);
        }
        return updated;
      });
    },
    []
  );

  // 활성 소스 목록 가져오기
  const getActiveSources = useCallback(() => {
    return sources.filter((s) => s.isActive);
  }, [sources]);

  // 활성 파일명 목록 가져오기
  const getActiveFilenames = useCallback(() => {
    return sources.filter((s) => s.isActive).map((s) => s.filename);
  }, [sources]);

  // 모든 소스 초기화
  const clearAllSources = useCallback(() => {
    setSources([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear RAG sources from storage:", error);
    }
  }, []);

  const value: RAGSourcesContextType = {
    sources,
    isLoading,
    addSource,
    removeSource,
    toggleSourceActive,
    updateSourceMetadata,
    getActiveSources,
    getActiveFilenames,
    clearAllSources,
  };

  return (
    <RAGSourcesContext.Provider value={value}>
      {children}
    </RAGSourcesContext.Provider>
  );
}

export function useRAGSources() {
  const context = useContext(RAGSourcesContext);
  if (context === undefined) {
    throw new Error("useRAGSources must be used within a RAGSourcesProvider");
  }
  return context;
}

