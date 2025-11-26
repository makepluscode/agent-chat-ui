import { Button } from "@/components/ui/button";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export default function RightSidebar() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [rightSidebarOpen, setRightSidebarOpen] = useQueryState(
    "rightSidebarOpen",
    parseAsBoolean.withDefault(false),
  );

  return (
    <>
      <div className="shadow-inner-left hidden h-screen w-[300px] shrink-0 flex-col items-start justify-start gap-6 border-l-[1px] border-slate-300 lg:flex">
        <div className="flex w-full items-center justify-between px-4 pt-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            Tools
          </h1>
          <Button
            className="hover:bg-gray-100"
            variant="ghost"
            onClick={() => setRightSidebarOpen((p) => !p)}
          >
            {rightSidebarOpen ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </Button>
        </div>
        <Separator />
        <div className="w-full px-4 pt-4">
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Button
                key={i}
                className="w-full rounded-lg"
                variant="default"
              >
                Tool{i + 1}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
          {/* Content goes here */}
        </div>
      </div>
      <div className="lg:hidden">
        <Sheet
          open={!!rightSidebarOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setRightSidebarOpen(open);
          }}
        >
          <SheetContent
            side="right"
            className="flex lg:hidden"
          >
            <SheetHeader>
              <SheetTitle>Tools</SheetTitle>
            </SheetHeader>
            <Separator />
            <div className="w-full px-4 pt-4 pb-4">
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Button
                    key={i}
                    className="w-full rounded-lg"
                    variant="default"
                  >
                    Tool{i + 1}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
              {/* Content goes here */}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
