import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Search, FileText } from "lucide-react";
import { useRAGSources } from "@/providers/RAGSources";
import { SourceInfoDialog } from "./source-info-dialog";
import { useState } from "react";
import { RAGSource } from "@/types/rag-source";

export function SourceList() {
  const { sources, toggleSourceActive } = useRAGSources();
  const [selectedSource, setSelectedSource] = useState<RAGSource | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  const handleInfoClick = (source: RAGSource) => {
    setSelectedSource(source);
    setShowInfoDialog(true);
  };

  if (sources.length === 0) {
    return null;
  }

  return (
    <>
      <div className="w-full px-4 pt-2 space-y-2">
        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Checkbox
              checked={source.isActive}
              onCheckedChange={() => toggleSourceActive(source.id)}
              id={`source-${source.id}`}
            />
            <label
              htmlFor={`source-${source.id}`}
              className="flex-1 flex items-center gap-2 cursor-pointer min-w-0"
            >
              <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-700 truncate">
                {source.filename}
              </span>
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleInfoClick(source)}
            >
              <Search className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        ))}
      </div>

      {/* 파일 정보 다이얼로그 */}
      {selectedSource && selectedSource.metadata && (
        <SourceInfoDialog
          open={showInfoDialog}
          onOpenChange={setShowInfoDialog}
          filename={selectedSource.filename}
          metadata={selectedSource.metadata}
        />
      )}
    </>
  );
}

